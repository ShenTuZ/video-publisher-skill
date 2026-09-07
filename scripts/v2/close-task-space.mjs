#!/usr/bin/env node
import { spawn } from "node:child_process";

function runEgo(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.VIDEO_PUBLISHER_V2_EGO_COMMAND || "ego-browser", ["nodejs"], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", code => resolve({ code: code ?? 1, stdout, stderr }));
    child.stdin.end(script);
  });
}

const [rawTaskSpaceId, expectedName = ""] = process.argv.slice(2);
const taskSpaceId = Number(rawTaskSpaceId);
if (!Number.isInteger(taskSpaceId) || taskSpaceId < 1) {
  console.error("Usage: close-task-space.mjs <task-space-id> [exact-task-space-name]");
  process.exit(2);
}

const script = [
  `const taskSpaceId = ${JSON.stringify(taskSpaceId)};`,
  `const expectedName = ${JSON.stringify(expectedName)};`,
  "const spaces = await listTaskSpaces();",
  "const task = spaces.find(item => Number(item.id) === taskSpaceId);",
  "if (!task) {",
  "  cliLog(JSON.stringify({ taskSpaceId, closed: true, alreadyClosed: true }));",
  "} else {",
  "  if (expectedName && task.name !== expectedName) throw new Error(`Task-space identity mismatch: expected ${expectedName}, got ${task.name || \"unknown\"}`);",
  "  const result = await completeTaskSpace(taskSpaceId, { keep: false });",
  "  if (result?.done !== true) throw new Error(`Task-space cleanup did not complete: ${JSON.stringify(result)}`);",
  "  const remaining = await listTaskSpaces();",
  "  if (remaining.some(item => Number(item.id) === taskSpaceId)) throw new Error(`Task-space cleanup did not remove ${taskSpaceId}`);",
  "  cliLog(JSON.stringify({ taskSpaceId, closed: true, alreadyClosed: false }));",
  "}",
].join("\n");

const result = await runEgo(script);
if (result.code !== 0) {
  console.error((result.stderr || result.stdout || "Task-space cleanup failed").trim());
  process.exit(result.code);
}
process.stdout.write(result.stdout);
