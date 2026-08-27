#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
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
import { inspectMediaFile, validateMediaForPlatform } from "../lib/media.mjs";
import { buildIdentity } from "./lib/identity.mjs";
import { acquireJobLock } from "./lib/job-lock.mjs";
import { JobStore } from "./lib/job-store.mjs";
import { BLOCKER, PLATFORMS, classifyVerdict, compactVerdict, evaluateObservation } from "./lib/model.mjs";
import { parseV2Result } from "./lib/result-line.mjs";
import { runPool, SerialQueue } from "./lib/scheduler.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(os.homedir(), ".video-publisher", "v2-jobs");
const FAST_OVERLAP_PLATFORMS = new Set(["xiaohongshu", "douyin", "wechat_channels"]);
const AUTO_PUBLISH_PLATFORMS = new Set(["xiaohongshu", "douyin", "wechat_channels"]);
const HEALTH_CHECK_CONCURRENCY = 1;
const FAST_PLATFORM_ORDER = ["douyin", "xiaohongshu", "wechat_channels"];
const validators = { xiaohongshu: validateXiaohongshuPackage, douyin: validateDouyinPackage, wechat_channels: validateWechatChannelsPackage };

class UsageError extends Error {}
const activeLockReleases = [];

function positive(raw, name) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) throw new UsageError(`${name} must be a positive integer`);
  return value;
}

function prioritizeFastPlatforms(platforms) {
  return [...platforms].sort((left, right) => FAST_PLATFORM_ORDER.indexOf(left) - FAST_PLATFORM_ORDER.indexOf(right));
}

function parseArgs(argv) {
  const config = loadConfig({ requireOnboarded: true });
  const options = {
    inspectOnly: false,
    originalRightsConfirmed: false,
    originalityPolicy: config.declarations.originalityPolicy,
    stateRoot: DEFAULT_ROOT,
    jobId: "",
    checkConcurrency: config.execution.checkConcurrency,
    uploadConcurrency: config.execution.uploadConcurrency,
    autoPublishOnReady: config.execution.autoPublishOnReady === true,
    explicitPublishOnReady: false,
    publishProfile: config.execution.publishProfile,
  };
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--inspect-only") { options.inspectOnly = true; continue; }
    if (arg === "--confirm-original-rights") { options.originalRightsConfirmed = true; continue; }
    if (arg === "--publish-on-ready") { options.autoPublishOnReady = true; options.explicitPublishOnReady = true; continue; }
    if (arg === "--stop-at-ready") { options.autoPublishOnReady = false; continue; }
    if (arg === "--fast") { options.publishProfile = "fast"; continue; }
    if (arg === "--strict") { options.publishProfile = "strict"; continue; }
    const setters = {
      "--state-root": value => { options.stateRoot = path.resolve(value); },
      "--job-id": value => { options.jobId = value; },
      "--check-concurrency": value => { options.checkConcurrency = positive(value, arg); },
      "--upload-concurrency": value => { options.uploadConcurrency = positive(value, arg); },
    };
    if (setters[arg]) {
      if (!argv[index + 1]) throw new UsageError(`${arg} requires a value`);
      setters[arg](argv[++index]);
      continue;
    }
    if (arg.startsWith("--")) throw new UsageError(`Unknown option: ${arg}`);
    positional.push(arg);
  }
  if (!positional.length) throw new UsageError("Usage: publisher.mjs <package.json> [task-suffix] [platform...] [--fast|--strict|--inspect-only|--confirm-original-rights|--publish-on-ready|--stop-at-ready]");
  const packagePath = path.resolve(positional.shift());
  let taskSuffix = "manual";
  if (positional.length && !PLATFORMS.includes(positional[0])) taskSuffix = positional.shift();
  const platforms = positional.length ? positional : [...config.defaultPlatforms];
  if (platforms.some(platform => !PLATFORMS.includes(platform))) throw new UsageError("Unsupported platform argument");
  const unavailablePlatforms = platforms.filter(platform => !config.availablePlatforms.includes(platform));
  if (unavailablePlatforms.length) {
    throw new UsageError(`Platform is not configured as available: ${unavailablePlatforms.join(", ")}. Update Video Publisher onboarding before browser work.`);
  }
  const unsupportedAutoPublish = options.autoPublishOnReady && !options.explicitPublishOnReady ? platforms.filter(platform => !AUTO_PUBLISH_PLATFORMS.has(platform)) : [];
  if (unsupportedAutoPublish.length) throw new UsageError(`Automatic final publish is not live-accepted for: ${unsupportedAutoPublish.join(", ")}. Use --stop-at-ready for this run.`);
  return { ...options, packagePath, taskSuffix, platforms };
}

function runCapture(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", code => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

function initialState(jobId, identity, args) {
  return {
    schemaVersion: 3,
    jobId,
    fingerprint: identity.fingerprint,
    packagePath: args.packagePath,
    taskSuffix: args.taskSuffix,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "new",
    scheduler: { checkConcurrency: args.checkConcurrency, uploadConcurrency: args.uploadConcurrency, uiConcurrency: 1 },
    video: identity.video,
    assets: identity.assets,
    platforms: Object.fromEntries(args.platforms.map(platform => [platform, { status: "new", taskSpaceId: null, taskSpaceName: null, receipts: {}, verdict: null, history: [] }])),
  };
}

async function main() {
  if (process.platform !== "darwin") {
    throw new UsageError("Video Publisher requires macOS because Ego Lite currently supports macOS only.");
  }
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.packagePath)) throw new Error(`Package JSON not found: ${args.packagePath}`);
  const pkg = readPackage(args.packagePath);
  const media = inspectMediaFile(pkg.videoPath);
  const preflightErrors = Object.fromEntries(args.platforms.map(platform => [platform, [
    ...validators[platform](pkg),
    ...validateMediaForPlatform(pkg, platform, media),
  ]]));
  const runnablePlatforms = args.platforms.filter(platform => preflightErrors[platform].length === 0);
  if (!runnablePlatforms.length) {
    throw new Error(args.platforms
      .map(platform => `Package preflight failed for ${platform}: ${preflightErrors[platform].join("; ")}`)
      .join("\n"));
  }
  const rightsTargets = runnablePlatforms.filter(platform => (platform === "xiaohongshu" && pkg.xhsOriginal === true) || (platform === "wechat_channels" && pkg.wechatOriginal === true));
  const standingOriginalityPolicy = args.originalityPolicy === "all_videos_original";
  if (!args.inspectOnly && rightsTargets.length && !standingOriginalityPolicy && !args.originalRightsConfirmed) {
    throw new UsageError(`Originality confirmation is required before browser mutation for: ${rightsTargets.join(", ")}. Complete onboarding with declarations.originalityPolicy=all_videos_original, or confirm this run and add --confirm-original-rights.`);
  }
  const identity = await buildIdentity(pkg);
  const jobId = args.jobId || identity.fingerprint.slice(0, 16);
  const jobDir = path.join(args.stateRoot, jobId);
  activeLockReleases.push(acquireJobLock(path.join(args.stateRoot, ".publisher"), {
    jobId,
    packagePath: args.packagePath,
    scope: "publisher",
  }));
  activeLockReleases.push(acquireJobLock(jobDir, { jobId, packagePath: args.packagePath }));
  const store = new JobStore(jobDir, initialState(jobId, identity, args));
  const state = await store.initialize();
  if (store.lastRecovery) {
    console.error(`[video-publisher-v2] restored corrupt job state from atomic backup; preserved=${store.lastRecovery.corruptPath}`);
  }
  if (state.fingerprint !== identity.fingerprint) throw new Error(`Job ${jobId} belongs to another package`);
  for (const platform of args.platforms) state.platforms[platform] ||= { status: "new", taskSpaceId: null, taskSpaceName: null, receipts: {}, verdict: null, history: [] };
  for (const platform of args.platforms) {
    const item = state.platforms[platform];
    if (!item.taskSpaceName && item.lastEvidencePath && fs.existsSync(item.lastEvidencePath)) {
      try {
        const saved = JSON.parse(fs.readFileSync(item.lastEvidencePath, "utf8"));
        const observation = saved.observation || saved;
        if (observation.taskSpace && (item.taskSpaceId == null || Number(observation.taskSpaceId) === Number(item.taskSpaceId))) {
          item.taskSpaceName = observation.taskSpace;
        }
      } catch {}
    }
    if (item.receiptTaskSpaceId != null && item.taskSpaceId != null && Number(item.receiptTaskSpaceId) !== Number(item.taskSpaceId)) {
      item.receipts = {};
      item.receiptTaskSpaceId = null;
      await store.clearReceiptCheckpoint(platform);
    }
    const checkpoint = await store.loadReceiptCheckpoint(platform, state.fingerprint, item.taskSpaceId);
    if (checkpoint) {
      item.receipts = { ...checkpoint.receipts, ...(item.receipts || {}) };
      item.receiptTaskSpaceId = checkpoint.taskSpaceId ?? item.receiptTaskSpaceId ?? item.taskSpaceId ?? null;
    }
  }
  for (const platform of args.platforms.filter(key => preflightErrors[key].length > 0)) {
    const item = state.platforms[platform];
    const observedAt = new Date().toISOString();
    const blocker = {
      code: BLOCKER.PLATFORM_REJECTED_ASSET,
      message: preflightErrors[platform].join("; "),
      retryable: false,
      requiresUser: false,
      evidence: { errors: preflightErrors[platform], media },
    };
    const observation = {
      schemaVersion: 1,
      platform,
      phase: "preflight",
      taskSpaceId: item.taskSpaceId ?? null,
      observedAt,
      finalPublishClicked: false,
      gates: {},
      blocker,
      evidence: { media },
    };
    const verdict = { platform, phase: "preflight", taskSpaceId: item.taskSpaceId ?? null, ready: false, missing: ["preflight"], blocker };
    item.status = "blocked";
    await store.record(platform, "preflight", observation, verdict);
  }
  state.status = args.inspectOnly ? "inspecting" : "running";
  await store.save();

  const runnerPath = path.resolve(process.env.VIDEO_PUBLISHER_V2_RUNNER || path.join(DIR, "run-platform.mjs"));
  let inputChannelBroken = false;
  async function invoke(platform, phase) {
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();
    const item = state.platforms[platform];
    const previousTaskSpaceId = item.taskSpaceId;
    const runnerArgs = [runnerPath, platform, args.packagePath, phase, `${args.taskSuffix}-${jobId}`, item.taskSpaceId ? String(item.taskSpaceId) : ""];
    if (args.originalRightsConfirmed) runnerArgs.push("--confirm-original-rights");
    if (phase === "publish") runnerArgs.push("--confirm-final-publish");
    const execution = await runCapture(process.execPath, runnerArgs, {
      env: {
        ...process.env,
        VIDEO_PUBLISHER_V2_RECEIPTS: JSON.stringify(item.receipts || {}),
        VIDEO_PUBLISHER_V2_CHECKPOINT_PATH: store.receiptCheckpointPath(platform),
        VIDEO_PUBLISHER_V2_FINGERPRINT: state.fingerprint,
        VIDEO_PUBLISHER_V2_TASK_NAME: item.taskSpaceName || "",
        VIDEO_PUBLISHER_V2_PUBLISH_PROFILE: args.publishProfile,
      },
    });
    const observation = parseV2Result(`${execution.stdout}\n${execution.stderr}`);
    observation.timing = { startedAt, finishedAt: new Date().toISOString(), durationMs: Date.now() - startedMs };
    if (observation.taskSpace) item.taskSpaceName = observation.taskSpace;
    const taskSpaceChanged = previousTaskSpaceId != null && observation.taskSpaceId != null
      && Number(previousTaskSpaceId) !== Number(observation.taskSpaceId);
    const taskSpaceRecreated = observation.taskSpaceRecovery?.recreated === true;
    if (taskSpaceChanged || taskSpaceRecreated) {
      item.receipts = {};
      item.receiptTaskSpaceId = null;
      await store.clearReceiptCheckpoint(platform);
      observation.recovery = {
        ...(observation.recovery || {}),
        taskSpaceRecreated: {
          previousTaskSpaceId: observation.taskSpaceRecovery?.previousTaskSpaceId ?? previousTaskSpaceId,
          taskSpaceId: observation.taskSpaceId,
          numericIdChanged: taskSpaceChanged,
        },
      };
    }
    if (observation.receipts) {
      item.receipts = { ...(item.receipts || {}), ...observation.receipts };
      item.receiptTaskSpaceId = observation.taskSpaceId ?? item.taskSpaceId ?? null;
    }
    if (phase === "publish") {
      const published = observation.published === true && observation.publishReceipt?.confirmed === true && !observation.blocker;
      const blocker = observation.blocker || (published ? null : { code: BLOCKER.STATE_AMBIGUOUS, message: "平台发表结果没有被页面证据确认", retryable: true, requiresUser: false, evidence: observation.publishReceipt || null });
      const verdict = { platform, phase, taskSpaceId: observation.taskSpaceId ?? item.taskSpaceId ?? null, ready: published, published, missing: published ? [] : ["published"], blocker };
      item.status = published ? "published" : (blocker?.requiresUser ? "blocked_user" : "blocked");
      await store.record(platform, phase, observation, verdict);
      console.error(`[video-publisher-v2] ${platform} publish: ${published ? "PUBLISHED" : blocker?.code}`);
      return { observation, verdict };
    }
    const verdict = evaluateObservation(observation);
    if (verdict.blocker?.code === BLOCKER.INPUT_CHANNEL_BROKEN) inputChannelBroken = true;
    item.status = classifyVerdict(verdict);
    if (observation.blocker) item.status = verdict.blocker?.requiresUser ? "blocked_user" : "blocked";
    await store.record(platform, phase, observation, compactVerdict(verdict));
    console.error(`[video-publisher-v2] ${platform} ${phase}: ${verdict.ready ? "READY" : verdict.missing.join(",") || verdict.blocker?.code}`);
    return { observation, verdict };
  }

  const activePlatforms = () => runnablePlatforms.filter(platform => state.platforms[platform].status !== "published");
  const ui = new SerialQueue();
  async function publishReadyPlatforms() {
    if (!args.autoPublishOnReady) return;
    for (const platform of args.platforms) {
      if (state.platforms[platform].status !== "ready") continue;
      await ui.enqueue(() => invoke(platform, "publish"));
    }
    await ui.idle();
  }
  if (!args.inspectOnly && args.platforms.every(platform => state.platforms[platform].status === "published")) {
    state.status = "published";
    await store.save(); await store.close();
    console.log(JSON.stringify(summary(state, args.platforms, store.statePath), null, 2));
    return;
  }

  const persistentSingleFastPlatform = !args.inspectOnly
    && args.platforms.length === 1
    && activePlatforms().length === 1
    && new Set(["xiaohongshu", "wechat_channels"]).has(activePlatforms()[0]);

  // Two fresh read-only passes prove that the shared Ego channel can select every
  // platform page before any upload input is touched. Health checks are deliberately
  // single-channel: Ego's runtime transport is process-wide, so concurrent page
  // probes can turn a short-lived RPC stall into a whole-job channel failure.
  console.error(`[video-publisher-v2] browser health inspect 1/2 serial=${HEALTH_CHECK_CONCURRENCY}`);
  await runPool(activePlatforms(), HEALTH_CHECK_CONCURRENCY, platform => invoke(platform, "inspect"));
  if (!inputChannelBroken) {
    console.error(`[video-publisher-v2] browser health inspect 2/2 serial=${HEALTH_CHECK_CONCURRENCY}`);
    await runPool(activePlatforms(), HEALTH_CHECK_CONCURRENCY, platform => invoke(platform, "inspect"));
  }
  if (!inputChannelBroken && !persistentSingleFastPlatform) await publishReadyPlatforms();
  if (args.inspectOnly) {
    state.status = runnablePlatforms.length === args.platforms.length ? "inspected" : "blocked";
    await store.save();
    await store.close();
    console.log(JSON.stringify(summary(state, args.platforms, store.statePath), null, 2));
    if (state.status === "blocked") process.exitCode = 10;
    return;
  }

  const userBlocked = activePlatforms().find(platform => state.platforms[platform].status === "blocked_user");
  if (userBlocked) {
    state.status = "paused_user";
    await store.save(); await store.close();
    console.log(JSON.stringify(summary(state, args.platforms, store.statePath), null, 2));
    process.exitCode = 10; return;
  }

  if (persistentSingleFastPlatform) {
    const platform=activePlatforms()[0];
    console.error(`[video-publisher-v2] persistent ${platform} prepare: inspect -> inject -> overlap prefill -> upload wait -> repair`);
    await invoke(platform, "prepare");
    if (state.platforms[platform].status !== "blocked_user") {
      console.error(`[video-publisher-v2] independent ${platform} verify`);
      await invoke(platform, "verify");
    }
    let complete = args.platforms.every(platform => state.platforms[platform].status === "published" || state.platforms[platform].verdict?.ready === true);
    if (complete && args.autoPublishOnReady) {
      console.error("[video-publisher-v2] READY verified; automatic final publish authorized by user configuration");
      await invoke(platform, "publish");
      complete = state.platforms[platform].status === "published";
    }
    state.status = state.platforms[platform].status === "published" ? "published" : (complete ? "ready" : (state.platforms[platform].status === "blocked_user" ? "paused_user" : "blocked"));
    await store.save(); await store.close();
    console.log(JSON.stringify(summary(state, args.platforms, store.statePath), null, 2));
    if (!complete) process.exitCode = 10;
    return;
  }

  const injectTargets = inputChannelBroken ? [] : prioritizeFastPlatforms(activePlatforms().filter(platform => FAST_OVERLAP_PLATFORMS.has(platform) && state.platforms[platform].status === "needs_upload"));
  const injectConcurrency = args.publishProfile === "fast" ? 1 : args.uploadConcurrency;
  console.error(`[video-publisher-v2] fast inject parallel=${injectConcurrency}: ${injectTargets.join(",") || "none"}`);
  await runPool(injectTargets, injectConcurrency, platform => invoke(platform, "inject"));

  const overlapPrefillTargets = inputChannelBroken ? [] : prioritizeFastPlatforms(injectTargets.filter(platform => state.platforms[platform].status === "needs_upload"));
  console.error(`[video-publisher-v2] overlap prefill UI serial: ${overlapPrefillTargets.join(",") || "none"}${inputChannelBroken ? " (input channel broken)" : ""}`);
  for (const platform of overlapPrefillTargets) {
    if (inputChannelBroken) break;
    await ui.enqueue(() => invoke(platform, "prefill"));
    if (platform === "douyin" && args.autoPublishOnReady && state.platforms.douyin.status === "needs_upload") {
      console.error("[video-publisher-v2] Douyin upload is active and its form is complete; submit before upload completion");
      await ui.enqueue(() => invoke("douyin", "publish"));
    }
  }
  await ui.idle();

  const fastWaitTargets = inputChannelBroken ? [] : injectTargets.filter(platform => state.platforms[platform].status === "needs_upload");
  const legacyUploadTargets = inputChannelBroken ? [] : activePlatforms().filter(platform => !FAST_OVERLAP_PLATFORMS.has(platform) && state.platforms[platform].status === "needs_upload");
  const uploadWork = [
    ...fastWaitTargets.map(platform => ({ platform, phase: "wait_upload" })),
    ...legacyUploadTargets.map(platform => ({ platform, phase: "upload" })),
  ];
  console.error(`[video-publisher-v2] upload wait parallel=${args.uploadConcurrency}: ${uploadWork.map(item => `${item.platform}:${item.phase}`).join(",") || "none"}`);
  await runPool(uploadWork, args.uploadConcurrency, item => invoke(item.platform, item.phase));
  await publishReadyPlatforms();

  // Fast adapters exit their injection runners as soon as the browser proves upload start.
  // One serial UI controller may then prefill fields while browser uploads continue.
  // No second input controller is allowed, and post-upload repair still waits for every
  // upload waiter/legacy uploader to exit. Any broken channel circuit-breaks later work.
  // A broken browser input channel is also a phase-wide circuit breaker: wait for the
  // parallel runners, skip every later mutation, and let final read-only verification
  // record whatever page truth Ego exposes after restart.
  const mutationTargets = inputChannelBroken ? [] : activePlatforms().filter(platform => state.platforms[platform].status === "needs_mutation");
  console.error(`[video-publisher-v2] UI serial: ${mutationTargets.join(",") || "none"}${inputChannelBroken ? " (input channel broken)" : ""}`);
  for (const platform of mutationTargets) {
    if (inputChannelBroken) break;
    await ui.enqueue(() => invoke(platform, "mutate"));
  }
  await ui.idle();
  await publishReadyPlatforms();

  if (args.publishProfile === "strict" || inputChannelBroken) {
    console.error(`[video-publisher-v2] final verify parallel=${args.checkConcurrency}`);
    await runPool(activePlatforms().filter(platform => state.platforms[platform].status !== "blocked_user"), args.checkConcurrency, platform => invoke(platform, "verify"));
    await publishReadyPlatforms();
  } else {
    console.error("[video-publisher-v2] fast profile: skip redundant final full-page verification");
  }

  // One targeted retry is allowed only for an idempotent mutation whose fresh verifier
  // returned STATE_AMBIGUOUS. Typed action/auth/risk-control failures are never looped.
  const retryTargets = (args.publishProfile === "strict" && !inputChannelBroken ? activePlatforms() : []).filter(platform => {
    const verdict = state.platforms[platform].verdict;
    return state.platforms[platform].status === "needs_mutation" && verdict?.blocker?.code === BLOCKER.STATE_AMBIGUOUS;
  });
  for (const platform of retryTargets) {
    if (inputChannelBroken) break;
    await ui.enqueue(() => invoke(platform, "mutate"));
  }
  await ui.idle();
  if (retryTargets.length) {
    await runPool(retryTargets, args.checkConcurrency, platform => invoke(platform, "verify"));
    await publishReadyPlatforms();
  }

  let complete = args.platforms.every(platform => state.platforms[platform].status === "published" || state.platforms[platform].verdict?.ready === true);
  if (args.autoPublishOnReady) complete = args.platforms.every(platform => state.platforms[platform].status === "published");
  state.status = args.platforms.every(platform => state.platforms[platform].status === "published") ? "published" : (complete ? "ready" : "blocked");
  await store.save(); await store.close();
  console.log(JSON.stringify(summary(state, args.platforms, store.statePath), null, 2));
  if (!complete) process.exitCode = 10;
}

function summary(state, platforms, statePath) {
  return {
    schemaVersion: 3,
    jobId: state.jobId,
    status: state.status,
    ready: platforms.every(platform => state.platforms[platform].verdict?.ready === true),
    statePath,
    scheduler: state.scheduler,
    platforms: Object.fromEntries(platforms.map(platform => {
      const item = state.platforms[platform];
      return [platform, { status: item.status, taskSpaceId: item.taskSpaceId, ready: item.verdict?.ready === true, published: item.status === "published" || item.verdict?.published === true, missing: item.verdict?.missing || [], blocker: item.verdict?.blocker || null, evidencePath: item.lastEvidencePath || null }];
    })),
  };
}

main()
  .catch(error => {
    console.error(`[video-publisher-v2] fatal: ${String(error?.stack || error)}`);
    process.exitCode = error instanceof UsageError ? 2 : 1;
  })
  .finally(() => {
    for (const release of activeLockReleases.reverse()) release();
  });
