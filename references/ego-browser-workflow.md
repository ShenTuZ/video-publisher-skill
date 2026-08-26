# Ego Lite Workflow

Use Ego Lite for every creator-platform browser action. The production orchestrator owns task-space creation and reuse; use the mechanics below only for adapter work or diagnosis after a runner blocker.

## Task Spaces

Use one persistent task space per platform. Store both its numeric id and its exact stable name.

```js
await useOrCreateTaskSpace(taskSpaceId)
```

Do not call `completeTaskSpace` during upload, mutation, or verification. Leave a ready draft visible unless the user explicitly ends that platform step.

If Ego says the user took control, stop. After the user explicitly says to continue:

```js
await claimTaskSpace(taskSpaceId)
```

Do not route around ownership by opening a new task space.

If a persisted numeric id is explicitly reported as `task space not found` after a browser crash or interrupted desktop run, the maintained runner may recreate the same named platform task space and persist its new id. The runner also emits an explicit recreation signal because Ego may recycle the previous numeric id; treat that signal as identity loss and invalidate all receipts from the old page. Do not use this fallback for user-control, inactive, or ownership errors.

Ego may recycle an existing numeric id for a different task space after restart. Before reuse, compare the live name with the persisted exact name. A mismatch is the same identity-loss class as a missing id: never inspect or mutate the colliding space, select or create only the persisted exact name, persist its current id, and invalidate receipts tied to the previous page.

This fallback has passed real task-space-loss tests on all three supported platforms. A replacement space must start from fresh page truth, rebuild only that platform, generate new cover receipts when the old page no longer exists, persist the replacement numeric id, and leave every unaffected platform untouched.

If the Ego Lite process exits or returns no structured observation, return a retryable `INPUT_CHANNEL_BROKEN` blocker with all required gates false and `finalPublishClicked: false`. Do not reinterpret the missing browser channel as a missing upload input, do not start reinjection in that run, and do not throw away the persisted job. The normal `run-fast-platforms.sh` entry retries only that same persisted job after 5 seconds and 10 seconds when the current attempt records this exact blocker in state history; this remains true even if its final read-only verification later records ordinary missing fields. After two failed recoveries it exits without publishing an unverified platform. A recovered invocation performs normal task-space recovery and fresh inspection.

Because the input channel is process-wide, one such blocker circuit-breaks all remaining browser mutation in the invocation, including work queued for other task spaces. Already-started parallel runners may finish or return their own blocker; after they exit, only final read-only verification may run.

This boundary is real-tested during both parallel upload and serialized mutation. In the mutation test, Ego was terminated one second after the Douyin mutator process appeared; the two later platform mutators never started.

## Platform URLs

```text
xiaohongshu: https://creator.xiaohongshu.com/publish/publish?source=official&from=menu&target=video
douyin: https://creator.douyin.com/creator-micro/content/upload
wechat_channels: https://channels.weixin.qq.com/platform/post/create
```

## File Upload

Verify every absolute file path before browser work.

For ordinary video and image inputs, expose the platform’s existing input and use `uploadFile`. Do not create a fake input.


WeChat Channels is different: both its hidden video input and cover image input live in Wujie/open-root content. Find the real input across roots, get its remote object id, then call `DOM.setFileInputFiles`. The top-document `uploadFile('#selector', path)` helper cannot reach an id placed inside that shadow tree.

```js
const evaluated = await cdp('Runtime.evaluate', {
  expression: `(() => {
    const roots = [document, ...[...document.querySelectorAll('*')]
      .map(el => el.shadowRoot).filter(Boolean)]
    return roots.flatMap(root => [...root.querySelectorAll('input[type=file]')])
      .find(el => /video/.test(el.accept || ''))
  })()`,
  objectGroup: 'video-publisher-wechat'
})
await cdp('DOM.setFileInputFiles', {
  objectId: evaluated.result.objectId,
  files: [videoPath]
})
```

Read `platform-wechat-channels.md` before using this path.

Before inspecting or mutating WeChat Channels, activate its browser lifecycle:

```js
await cdp('Page.bringToFront', {})
await cdp('Page.setWebLifecycleState', { state: 'active' })
await cdp('Emulation.setFocusEmulationEnabled', { enabled: true })
```

A task-space tab can report `hasFocus: true` while `document.visibilityState` is still `hidden`. In that state, `页面初始化中`, uploads, Vue transitions, and dialog cleanup may stall. The adapter repeats lifecycle activation while waiting; do not replace this with blind reload loops.

Selecting an existing platform tab uses 150ms bounded readiness probes for a valid viewport, expected host, and a real platform shell marker. A transient `pageInfo` RPC failure receives at most three 200ms retries before returning `INPUT_CHANNEL_BROKEN`. Do not restore a fixed post-switch sleep; an apparently valid viewport without the upload/form shell is not ready.

`inspect`, `inject`, `prefill`, `mutate`, `verify`, and `publish` run with owned-process time limits. A timeout terminates that unresponsive Ego process group and returns structured `INPUT_CHANNEL_BROKEN` evidence; long upload/prepare phases retain their own 20-minute bounded limit. Do not manually kill a phase when this watchdog is active.

## Real Input Versus DOM State

Use framework-aware input events for plain controlled fields. For fragile rich editors or chip inputs, prefer a real focus/click plus CDP text insertion and real key events.


Topic entities must be committed through the real platform suggestion UI. Never insert entity HTML directly.

## Diagnostic Heredoc

Use a hand-written heredoc only after a maintained phase returns a blocker:

```bash
ego-browser nodejs <<'EOF'
await useOrCreateTaskSpace(123)
const tabs = await listTabs()
const tab = tabs.find(item => /creator\.douyin\.com/.test(item.url || ''))
if (tab) await switchTab(tab.targetId)
const state = await js(String.raw`(() => ({
  url: location.href,
  text: String(document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 1200)
}))()`)
cliLog(JSON.stringify(state))
EOF
```

Select the recorded numeric id. Do not perform final publishing or broad exploratory clicking.

## Verification

Freshly inspect after every mutation. Upload and cover helper return values are only action receipts; the platform adapter must also verify page state.

During inspect, prepare, mutate, and verify, stop before the final button and record its exact text, visibility, and disabled state. Only the separately authorized post-READY `publish` phase may permit and click it, and that phase must verify a platform success signal.
