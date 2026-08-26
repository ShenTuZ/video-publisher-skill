import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PLATFORM_DIR = path.join(DIR, "..", "platforms");

test("Xiaohongshu topics start through the native editor command", () => {
  const source = fs.readFileSync(path.join(PLATFORM_DIR, "xiaohongshu.mjs"), "utf8");
  const start = source.indexOf("async function rebuildXhsTopics");
  const end = source.indexOf("async function ensureXhsOriginal", start);
  assert.ok(start >= 0 && end > start, "topic rebuild function must remain discoverable");
  const topicFlow = source.slice(start, end);
  const lifecycle = topicFlow.indexOf("activateXhsTopicLifecycle()");
  const nativeStart = topicFlow.indexOf("topicButton.click()");
  const explicitFocus = topicFlow.indexOf("editor.focus()", nativeStart);
  const bareQuery = topicFlow.indexOf("await cdp('Input.insertText', { text: queryTag })", explicitFocus);
  assert.ok(lifecycle >= 0 && lifecycle < nativeStart, "the hidden post-crash page must be activated before topic input");
  assert.match(source, /Page\.setWebLifecycleState', \{ state: 'active' \}/);
  assert.ok(nativeStart >= 0, "the platform topic command must insert the leading hash");
  assert.ok(explicitFocus > nativeStart, "the editor must be refocused after the native command");
  assert.ok(bareQuery > explicitFocus, "only the bare topic query may be inserted after refocus");
  assert.doesNotMatch(topicFlow, /Input\.insertText', \{ text: `#\$\{queryTag\}` \}/);
  assert.match(topicFlow, /rebuildAttempt<=3/, "candidate failures must retry the whole exact topic set with a finite bound");
  assert.match(topicFlow, /attempt < 30/, "each native suggestion request must keep a bounded event-driven wait window");
  assert.match(topicFlow, /await wait\(\.2\)/, "topic candidates and commits must use short state polling");
  assert.doesNotMatch(topicFlow, /await wait\(1\.2\)/, "topic success path must not use the former fixed waits");
  assert.match(source, /const xhsOriginal = pkg\.xhsOriginal === true/);
  assert.match(source, /async function ensureXhsOriginalPolicy\(/);
  assert.match(source, /xhsOriginal\s*\?\s*\(state\.originalEnabled/);
  assert.match(source, /label:xhsOriginal\?'enable xhs original declaration':'disable xhs original declaration'/);
  for (const name of ["startXhsUpload", "waitXhsUploadOnly", "prefillXiaohongshu", "prepareXiaohongshu", "ensureXhsPkCoverOff", "ensureXhsContentType", "ensureXhsDefaultExtras", "ensureXhsVisibility", "ensureXhsSchedule", "publishXiaohongshu"]) {
    assert.match(source, new RegExp(`async function ${name}\\(`));
  }
  assert.match(source, /笔记含AI合成内容/);
  assert.match(source, /accept xhs original terms/);
  assert.match(source, /original confirmation dialog did not close/);
  assert.match(source, /permission-card-select/);
  assert.match(source, /semanticFinalMatch/);
  assert.match(source, /phase === 'publish'/);
  assert.match(source, /phase === 'inject'/);
  assert.match(source, /phase === 'prefill'/);
  assert.match(source, /phase === 'wait_upload'/);
  assert.match(source, /stableSamples>=3/);
});

test("Douyin preserves committed topic entities while retrying a failed tail query", () => {
  const source = fs.readFileSync(path.join(PLATFORM_DIR, "douyin.mjs"), "utf8");
  for (const name of ["startDouyinUpload", "prefillDouyin", "ensureDouyinPublishSettings", "ensureDouyinSchedule", "ensureDouyinDeclaration", "ensureDouyinMetadata", "publishDouyin"]) {
    assert.match(source, new RegExp(`async function ${name}\\(`), `${name} must remain an idempotent Douyin step`);
  }
  assert.match(source, /phase==='inject'/);
  assert.match(source, /phase==='prefill'/);
  assert.match(source, /phase==='wait_upload'/);
  assert.match(source, /officialActivity:activityEntities\.length===0/);
  assert.match(source, /controlPresent:state\.syncFound/);
  assert.match(source, /内容由AI生成/);
  assert.match(source, /declaration dialog did not close/);
  assert.doesNotMatch(source, /douyinOriginal/);
  assert.match(source, /authorizeFinalPublishGuard\(\)/);
  assert.match(source, /phase==='publish'/);
  const cleanupStart = source.indexOf("async function removeDouyinTrailingTopicQuery");
  const cleanupEnd = source.indexOf("async function addDouyinTopic", cleanupStart);
  const addEnd = source.indexOf("async function recoverDouyinTopicPrefix", cleanupEnd);
  assert.ok(cleanupStart >= 0 && cleanupEnd > cleanupStart && addEnd > cleanupEnd);
  const cleanup = source.slice(cleanupStart, cleanupEnd);
  const add = source.slice(cleanupEnd, addEnd);
  assert.match(cleanup, /expected\.startsWith\(initial\)/, "cleanup must prove the visible tail belongs to the missing topic");
  assert.match(cleanup, /entitiesUnchanged/, "cleanup must verify existing topic entities were preserved");
  assert.match(source, /value\.startsWith\(expectedDescription\)/, "the first topic query must be isolated from a shared description text node");
  assert.match(add, /attempt<=3/, "suggestion lookup must use a finite retry bound");
  assert.match(add, /removeDouyinTrailingTopicQuery\(queryTag,committedBefore\)/, "a failed lookup must remove only its own plain query");
});

test("Ego task-space selection rejects a recycled id with another name", () => {
  const source = fs.readFileSync(path.join(DIR, "..", "ego", "core.mjs"), "utf8");
  const start = source.indexOf("async function selectTaskSpace");
  const end = source.indexOf("async function selectPlatformTab", start);
  assert.ok(start >= 0 && end > start, "task-space selector must remain discoverable");
  const selection = source.slice(start, end);
  assert.match(selection, /activeTaskSpace\.name !== taskName/);
  assert.match(selection, /reason: 'task_space_identity_mismatch'/);
  assert.match(selection, /activeTaskSpace = await useOrCreateTaskSpace\(taskName\)/);
  const tabSelection = source.slice(source.indexOf("async function selectPlatformTab"), source.indexOf("async function armFinalPublishGuard"));
  assert.match(tabSelection, /attempt<21/);
  assert.match(tabSelection, /await wait\(\.15\)/);
  assert.doesNotMatch(tabSelection, /await wait\(1\.5\)/);
});

test("WeChat per-video controls are verified without touching location or collection", () => {
  const source = fs.readFileSync(path.join(PLATFORM_DIR, "wechat-channels.mjs"), "utf8");
  for (const name of [
    "startWechatUpload",
    "prepareWechatChannels",
    "publishWechatChannels",
    "waitWechatUploadOnly",
    "prefillWechatChannels",
    "setWechatTextFields",
    "setWechatShortTitle",
    "ensureWechatNoActivity",
    "ensureWechatSchedule",
    "ensureWechatAiLabel",
    "ensureWechatProductLink",
  ]) {
    assert.match(source, new RegExp(`async function ${name}\\(`), `${name} must remain an idempotent adapter step`);
  }
  assert.match(source, /locationPreserved:state\.locationText/);
  assert.match(source, /collectionUntouched:state\.collectionText/);
  assert.doesNotMatch(source, /ensureWechatLocation|setWechatLocation|ensureWechatCollection|setWechatCollection/);
  assert.match(source, /wechat product link option unavailable for this page\/account/);
  assert.match(source, /wechat first selectable product missing/);
  assert.match(source, /停业中\|不可添加\|已失效\|暂无商品/);
  assert.match(source, /选择需要添加的商品/);
  assert.ok(source.includes("^添加(?:\\(\\d+\\))?$"), "product footer must support both 添加 and 添加(n)");
  assert.match(source, /选择商品出现时机/);
  assert.match(source, /phase==='inject'/);
  assert.match(source, /phase==='prepare'/);
  assert.match(source, /phase==='publish'/);
  assert.match(source, /phase==='prefill'/);
  assert.match(source, /phase==='wait_upload'/);
  assert.match(source, /stableSamples>=3/, "upload completion must use three lightweight consecutive probes");
  assert.match(source, /await wait\(1\)/, "upload completion probes must avoid the former five-second polling interval");
  assert.match(source, /input\.select\(\)/, "scheduled time must use the platform's real time sub-input");
  assert.match(source, /await typeText\(expectedTime\)/, "scheduled time must be typed through Ego input");
  assert.match(source, /label:'commit scheduled time'/, "scheduled time must close the picker and verify the committed main value");

  const mutation = source.slice(source.indexOf("async function mutateWechatChannels"));
  assert.match(source, /async function ensureWechatOriginalPolicy\(/);
  assert.match(source, /wechatOriginal\?\(state\.originalFound&&state\.originalEnabled/);
  assert.match(source, /label:wechatOriginal\?'enable original declaration':'disable original declaration'/);
  assert.match(source, /authorizeFinalPublishGuard\(\)/, "final publish must pass through the READY-gated guard authorization");
  assert.match(source, /publishReceipt:\{confirmed:true/, "final publish must return explicit success evidence");
  assert.match(source, /wechatOriginal\?'声明原创':'直接发表'/, "final originality upsell must follow the package originality intent");
  const productFlow=source.slice(source.indexOf("async function ensureWechatProductLink"),source.indexOf("async function ensureWechatOriginalPolicy"));
  assert.match(productFlow, /interval=\.2/);
  assert.match(productFlow, /stable product option disappeared/);
  assert.match(productFlow, /el\.click\(\);return \{ok:true,native:true\}/);
  assert.doesNotMatch(productFlow, /await wait\((1|2)\)/, "product success path must use state polling instead of fixed waits");

  const order = ["actions.textFields", "actions.activity", "actions.schedule", "actions.aiLabel", "actions.productLink"]
    .map(token => mutation.indexOf(token));
  assert.ok(order.every(index => index >= 0));
  assert.deepEqual(order, [...order].sort((a, b) => a - b), "WeChat mutations must follow the confirmed field order");
});
