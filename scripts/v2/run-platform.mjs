#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  readPackage,
  validateDouyinPackage,
  validateWechatChannelsPackage,
  validateXiaohongshuPackage,
} from "../lib/content-package.mjs";
import { loadConfig } from "../lib/config.mjs";
import { PLATFORMS, requiredGates } from "./lib/model.mjs";
import { acquirePlatformLock } from "./lib/platform-lock.mjs";
import { parseV2Result, V2_RESULT_PREFIX } from "./lib/result-line.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const validators = {
  xiaohongshu: validateXiaohongshuPackage,
  douyin: validateDouyinPackage,
  wechat_channels: validateWechatChannelsPackage,
};
const platformFiles = {
  xiaohongshu: "xiaohongshu.mjs",
  douyin: "douyin.mjs",
  wechat_channels: "wechat-channels.mjs",
};
const PHASE_TIMEOUT_MS = Object.freeze({
  inspect: 45_000,
  inject: 45_000,
  prefill: 45_000,
  mutate: 60_000,
  verify: 45_000,
  publish: 45_000,
  wait_upload: 20 * 60_000,
  upload: 20 * 60_000,
  prepare: 20 * 60_000,
});

function usage() {
  return "Usage: run-platform.mjs <platform> <package.json> <inspect|prepare|inject|prefill|wait_upload|upload|mutate|verify|publish> [task-suffix] [task-space-id] [--confirm-original-rights] [--confirm-final-publish]";
}

function runEgo(script, timeoutMs) {
  return new Promise((resolve, reject) => {
    const detached = process.platform !== "win32";
    const child = spawn(process.env.VIDEO_PUBLISHER_V2_EGO_COMMAND || "ego-browser", ["nodejs"], { stdio: ["pipe", "pipe", "pipe"], detached });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let closed = false;
    const terminate = signal => {
      if (detached) {
        try { process.kill(-child.pid, signal); return; } catch {}
      }
      child.kill(signal);
    };
    const timer = setTimeout(() => {
      timedOut = true;
      terminate("SIGTERM");
      const forceKill = setTimeout(() => { if (!closed) terminate("SIGKILL"); }, 1_000);
      forceKill.unref?.();
    }, timeoutMs);
    timer.unref?.();
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", error => { clearTimeout(timer); reject(error); });
    child.on("close", (code, signal) => { closed = true; clearTimeout(timer); resolve({ code: code ?? 1, signal: signal || null, stdout, stderr, timedOut, timeoutMs }); });
    child.stdin.end(script);
  });
}

const rawArgs = process.argv.slice(2);
if (process.platform !== "darwin") {
  console.error("Video Publisher requires macOS because Ego Lite currently supports macOS only.");
  process.exit(2);
}
const originalRightsConfirmed = rawArgs.includes("--confirm-original-rights");
const finalPublishAuthorized = rawArgs.includes("--confirm-final-publish");
const positional = rawArgs.filter(arg => !["--confirm-original-rights", "--confirm-final-publish"].includes(arg));
if (positional.some(arg => arg.startsWith("--"))) {
  console.error(usage());
  process.exit(2);
}
const [platform, rawPackagePath, phase, taskSuffix = "manual", taskSpaceRef = ""] = positional;
if (!PLATFORMS.includes(platform) || !rawPackagePath || !["inspect", "prepare", "inject", "prefill", "wait_upload", "upload", "mutate", "verify", "publish"].includes(phase)) {
  console.error(usage());
  process.exit(2);
}
const config = loadConfig({ requireOnboarded: true });
const publishProfile = process.env.VIDEO_PUBLISHER_V2_PUBLISH_PROFILE || config.execution.publishProfile;
const standingOriginalityPolicy = config.declarations.originalityPolicy === "all_videos_original";
const packagePath = path.resolve(rawPackagePath);
if (!fs.existsSync(packagePath)) throw new Error(`Package JSON not found: ${packagePath}`);
const pkg = readPackage(packagePath);
const errors = validators[platform](pkg);
if (errors.length) throw new Error(`Package preflight failed for ${platform}: ${errors.join("; ")}`);
if (phase === "publish" && !finalPublishAuthorized) {
  console.error("Final publish phase requires --confirm-final-publish from the orchestrator.");
  process.exit(2);
}
const needsOriginalityConfirmation = (platform === "xiaohongshu" && pkg.xhsOriginal === true) || (platform === "wechat_channels" && pkg.wechatOriginal === true);
if (["prepare", "mutate"].includes(phase) && needsOriginalityConfirmation && !standingOriginalityPolicy && !originalRightsConfirmed) {
  console.error(`Originality confirmation is required before ${platform} mutation; set declarations.originalityPolicy=all_videos_original during onboarding, or add --confirm-original-rights after confirming this run.`);
  process.exit(2);
}
if (!fs.existsSync(pkg.videoPath)) throw new Error(`Video file not found: ${pkg.videoPath}`);
const timeoutOverride = Number(process.env.VIDEO_PUBLISHER_V2_PHASE_TIMEOUT_MS || "");
const phaseTimeoutMs = Number.isFinite(timeoutOverride) && timeoutOverride > 0
  ? Math.floor(timeoutOverride)
  : PHASE_TIMEOUT_MS[phase];

const header = [
  'import fs from "node:fs";',
  'import path from "node:path";',
  `const platform = ${JSON.stringify(platform)};`,
  `const phase = ${JSON.stringify(phase)};`,
  `const taskName = ${JSON.stringify(process.env.VIDEO_PUBLISHER_V2_TASK_NAME || `video publisher v2 ${platform} ${taskSuffix}`)};`,
  `const taskSpaceRef = ${JSON.stringify(taskSpaceRef)};`,
  `const packagePath = ${JSON.stringify(packagePath)};`,
  `const pkg = ${JSON.stringify(pkg)};`,
  `const videoPath = ${JSON.stringify(path.resolve(pkg.videoPath))};`,
  `const expectedReceipts = ${JSON.stringify(JSON.parse(process.env.VIDEO_PUBLISHER_V2_RECEIPTS || "{}"))};`,
  `const receiptCheckpointPath = ${JSON.stringify(process.env.VIDEO_PUBLISHER_V2_CHECKPOINT_PATH || "")};`,
  `const jobFingerprint = ${JSON.stringify(process.env.VIDEO_PUBLISHER_V2_FINGERPRINT || "")};`,
  `const finalPublishAuthorized = ${JSON.stringify(finalPublishAuthorized)};`,
  `const publishProfile = ${JSON.stringify(publishProfile)};`,
].join("\n");
const fragments = [
  header,
  fs.readFileSync(path.join(DIR, "ego", "core.mjs"), "utf8"),
  fs.readFileSync(path.join(DIR, "platforms", platformFiles[platform]), "utf8"),
  fs.readFileSync(path.join(DIR, "platforms", "dispatch.mjs"), "utf8"),
].join("\n\n");

const releasePlatformLock = acquirePlatformLock(platform, phase);
let execution;
try {
  try {
    execution = await runEgo(fragments, phaseTimeoutMs);
  } catch (error) {
    execution = { code: 1, stdout: "", stderr: String(error?.stack || error) };
  }
} finally {
  releasePlatformLock();
}
const combined = `${execution.stdout}\n${execution.stderr}`;
let result;
try {
  result = parseV2Result(combined, "Ego runner");
} catch (error) {
  const detail = combined.trim().slice(-1600);
  const userControl = /user (?:has|had) taken control|user took control|user is controlling|user controls|用户.*控制|not assigned to an agent|task space.*inactive/i.test(detail);
  if (execution.code === 0 && detail) {
    console.error(detail);
    throw error;
  }
  const failureEvidence = { reason: execution.timedOut ? "ego_phase_timeout" : "ego runner unavailable", exitCode: execution.code, signal: execution.signal || null, phaseTimeoutMs: execution.timeoutMs || phaseTimeoutMs, detail };
  const gates = Object.fromEntries(requiredGates(platform).map(name => [name, { ok: false, evidence: failureEvidence }]));
  gates.safety = { ok: false, evidence: { finalPublishClicked: false, guardArmed: false, blockedAttempts: 0 } };
  result = {
    schemaVersion: 1,
    platform,
    phase,
    taskSpaceId: Number(taskSpaceRef) || null,
    observedAt: new Date().toISOString(),
    finalPublishClicked: false,
    gates,
    blocker: {
      code: userControl ? "USER_CONTROL" : "INPUT_CHANNEL_BROKEN",
      message: userControl ? "Ego Lite 任务空间已由用户接管" : (execution.timedOut ? "Ego Lite 页面阶段超时，已停止无响应子进程" : "Ego Lite 已退出或无法返回页面证据"),
      retryable: !userControl,
      requiresUser: userControl,
      evidence: failureEvidence,
    },
  };
}
console.log(V2_RESULT_PREFIX + JSON.stringify(result));
