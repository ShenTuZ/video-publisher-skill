# WeChat Channels Adapter Contract

Read `platform-common.md` and `ego-browser-workflow.md` first.

## Current Acceptance Boundary

Historical runs passed upload completion, exact description, cover handling, no blocking dialog, enabled `发表`, and pre-READY `finalPublishClicked: false`. Current account evidence also confirms the optional originality control documented below.

The remaining system-level boundary is the four-platform production-orchestrator regression described in the root Skill.

## Wujie Lifecycle

The creator editor can be focused while `document.visibilityState` remains `hidden`. That state left `页面初始化中` and fade transitions stuck. Before readiness checks and during upload/dialog waits, call:

```text
Page.bringToFront
Page.setWebLifecycleState { state: active }
Emulation.setFocusEmulationEnabled { enabled: true }
```

Readiness requires the initialization toast to be gone and the real video input to exist, or an already uploaded editor to be proven. Perform at most one gentle reload after the initial activation window.

## Wujie Upload

Search `document` and all open shadow roots for the hidden video input whose `accept` contains `video`. Obtain the input’s CDP object id and use `DOM.setFileInputFiles` with the confirmed source path.

`页面初始化中` is a warning, not sufficient truth by itself. Do not inject while it is present merely because a stale input node exists.

After injection, dispatch one fallback change event only if no upload state appears. Never repeatedly inject the same file.

## Upload Completion

Cover cards can appear before upload completes. A real run displayed:

```text
50%
取消上传
封面预览
个人主页卡片
分享卡片
```

That state is uploading, not ready.

Require cover cards and the absence of all progress signals, including percentage text and `取消上传`, across three consecutive one-second lightweight probes. Then run one full page inspection before the upload runner exits. If an existing target upload is in progress, wait for it; do not inject again.

A 533 MB fault test terminated the orchestrator during the Wujie upload. The same task space resumed with action mode `resume_existing`, reactivated the page lifecycle while waiting, completed without reinjection, and later reached `READY` with both cover slots verified.

A later 534 MB run deleted the ready WeChat Channels task space. The same job created a replacement numeric space, re-uploaded and rebuilt only WeChat Channels, generated fresh vertical and horizontal cover receipts, preserved the other three ready drafts, and passed repeated no-op verification.

## Draft Identity

The page does not expose a reliable filename. Reuse an uploaded draft only when the description is empty or matches the expected package. A different non-empty description is foreign and must block.

## Text Defaults

Use the description field as:

```text
TITLE

#TOPIC_1 #TOPIC_2 #TOPIC_3
```

Fill `短标题` from `wechatShortTitle`. Prefer a meaningful semantic summary of at most 10 Unicode characters; the platform hard limit is 16. Override it only when the user explicitly supplies a different short title, then normalize and verify the exact resulting value.

Before package validation, normalize the short title with Unicode-aware rules: retain letters, numbers, and spaces; remove punctuation, emoji, hashtags, and other symbols; collapse repeated whitespace; safely cap the fallback at 10 characters without splitting a Unicode code point. An empty normalized result is invalid, and the independent 16-character platform limit remains enforced.

## Fast Overlap Flow

The `inject` phase exits after the page proves upload started. The browser keeps transferring the file while the serial `prefill` phase fills and independently verifies description, sanitized short title, activity, immediate/scheduled state, AI label, and product-link intent. `wait_upload` then performs only read-only completion checks. The later `mutate` phase remains idempotent and repairs anything that did not persist plus post-upload cover work.

When WeChat Channels is the only selected platform, `prepare` keeps one Ego process attached through those same logical steps. It writes description and short title in one DOM operation, reuses the initial gate snapshot for unchanged controls, and performs one final full inspection after repair. The orchestrator then starts a separate read-only `verify` process. Multi-platform runs continue using the split overlap phases.

Do not leave the injection runner alive while prefill controls the page, do not run more than one prefill controller, and never reinject a file whose page already shows upload progress. Any `INPUT_CHANNEL_BROKEN` result circuit-breaks later mutation.

## Stable Form Policies

- Preserve the existing location and record it as evidence; never open or change the location control.
- Leave `添加到合集` untouched; never select a collection.
- Require the activity field to read `不参与活动`. When it does not, select that exact option and verify it again.

## Publish Timing

Default `wechatPublish.mode` to `immediate`. Override it only when the user explicitly requests scheduled publishing; `scheduled` requires `publishAt` in `YYYY-MM-DD HH:mm` format. Select the matching `不定时`/`定时` radio and independently verify the state. Final `发表` remains blocked until the orchestrator has independently reached READY and the current run or private configuration authorizes automatic publishing.

## Final Publish

When automatic publishing is authorized, the orchestrator runs `publish` only after a fresh READY verifier. The adapter rechecks every WeChat page gate, authorizes version-2 final-button protection, scrolls the exact enabled `发表` button into view, clicks it through Ego, handles at most one scoped publish confirmation, and requires a visible success signal such as `已发表`, `发表成功`, or `定时发表成功`. A click receipt without a success signal is blocked.

Some accounts show a final originality upsell with `直接发表` and `声明原创`. Follow the package exactly: choose `直接发表` when `wechatOriginal:false`, and `声明原创` only when the current video explicitly enabled and confirmed originality. Never let this upsell override the package intent.

On 2026-08-26, a real two-platform 230.5 MB run reached independent READY on Xiaohongshu and WeChat Channels after parallel injection, serialized overlap prefill, and parallel completion waits. Xiaohongshu published first. WeChat then exposed the originality upsell; the first bounded run safely stopped without choosing. The repaired same-task `publish` phase recognized `wechatOriginal:false`, clicked exact `直接发表`, and verified `已发表`. No upload or metadata action was repeated.

For the current-day picker, open the read-only main date input, select the real time sub-input, type the requested `HH:mm`, and click outside the picker to commit. Verify the main value. If the requested date differs from the date offered by the current picker, block rather than selecting the wrong day.

## Product Link

Default `wechatLink.type` to `none` and leave `选择链接` untouched. Override it only when the user explicitly requests a product. `selection: search` searches with the supplied name/ID and selects only the matching candidate. `selection: first` is allowed only when the user explicitly asks for the first product: choose the first visible selectable product row, reject rows marked `停业中`/`不可添加`/`已失效`, confirm the choice when required, and verify the link section no longer shows `选择链接`. If the live link menu does not expose `商品`, return a typed blocker; never substitute `公众号文章` or `红包封面`.

The live product flow has two entry steps: select link type `商品`, then click `选择需要添加的商品` to open the table. A selected row must be committed with `添加(n)`, followed by the `选择商品出现时机` dialog. When the user gives no timing override, keep the platform default `视频播放5秒后出现` and click `确认`. The product gate must fail while either `选择链接` or `选择需要添加的商品` remains visible.

Current accounts may expose a radio in each product row and a plain `添加` footer instead of an in-row button plus `添加(n)`. Support both shapes. Poll the row, enabled add action, delayed timing dialog, final product text, and dialog fade-out at 200ms intervals with finite bounds. A selected main-link title is not sufficient while either product dialog remains active.

The Wujie link component has a real-tested click-through mismatch: pointer release during its animated transitions can activate adjacent `红包封面`. Invoke the platform's own click handlers only for opening the type menu, selecting exact `商品`, and opening `选择需要添加的商品`. Continue the product-table radio, add, timing, and verification steps through real pointer actions.

The 82 MB dual-platform optimization sample confirmed the first product as `GPT实战营…` through the radio/plain-add UI. The final stable preparation path reached both platforms READY in about 30 seconds; the previously measured serial publish stage for the same sample was about 9.2 seconds.

## Video Label

Default `wechatAiGenerated` to false and select `无需标注`. Set it to true and select `含AI生成内容` only when the user explicitly says the video contains AI-generated content, then independently verify the selected `.select-display` text.

## Optional Original Declaration

Default `wechatOriginal` to false. When false, keep `.declare-original-checkbox` unchecked; do not open its dialog. Only an explicit current-run user instruction may set it true, and the runner must reject browser mutation without current-video rights confirmation. When true, click the real main checkbox, accept the agreement inside the visible `原创权益` dialog, click that dialog's scoped `声明原创` button, and independently verify the main checkbox state. This dialog action is not the final `发表` control.

## Custom Cover

When enabled, upload both user-provided assets. Use the same flow first for the personal-profile `3:4` card and then for the share-card `4:3` card:

1. Click `.vertical-cover-wrap .edit-btn` for 3:4 or `.horizon-cover-wrap .edit-btn` for 4:3.
2. In the active edit-cover dialog, locate its existing image file input across open roots.
3. Inject the file through its CDP object id; top-document `uploadFile` cannot reach it.
4. Wait for `.single-cover-uploader-wrap img` to show a real preview.
5. If `裁剪封面图` is visible, click its visible `确定` first.
6. Wait for the parent editor to become visible, then click its visible `确认`.
7. On the share-card path, handle the intermediate `使用此素材` confirmation before the parent `确认` control.
8. Keep the lifecycle active until the editor closes and the corresponding main-card CDN URL changes.
9. Persist each URL with its absolute asset path and ratio, then require a separate verify process to find both again.

Only `.vertical-cover-wrap img.vertical-img-size` and `.horizon-cover-wrap img.horizon-img-size` are receipt targets. Require separate `3:4` and `4:3` receipts.

If a prior attempt leaves `编辑个人主页卡片` or `裁剪封面图` open, safely cancel that known editor, wait for it to close, and retry once. Do not misclassify an unrelated cover dialog as an original-declaration failure.

## Required Gates

```text
authenticated
correct draft identity
upload fully complete, with no percentage or 取消上传
exact description and hashtags
exact per-video short title
activity is `不参与活动`
exact immediate/scheduled state and scheduled time when requested
exact product-link intent
`含AI生成内容` or `无需标注` according to the package
original checkbox matches explicit `wechatOriginal`, default false
custom 3:4 and 4:3 receipts when enabled
no blocking dialog
visible enabled 发表 button
final publish not clicked
```

On 2026-08-26, later live evidence confirmed that the originality control appears on uploaded editors for this account. Its main checkbox is under `.declare-original-checkbox` and defaults unchecked; enabling opens a scoped `原创权益` agreement dialog. The adapter therefore treats originality as an explicit per-video boolean rather than a platform-wide default. The same account evidence confirmed the visible location, empty collection, `不参与活动`, radio values `0/1`, and the exact AI labels.

Later on 2026-08-26, a real clean-page `prefill` run completed before file injection: it filled the exact description, normalized `老板真正缺的，从来不是下属` to `老板真正缺的从来不是下属`, preserved location and empty collection, kept `不参与活动`/immediate/no-product defaults, selected `无需标注`, and left the final guard armed with zero attempts. The immediate second `prefill` was a no-op. No video was uploaded and the test task space was closed.

A subsequent real 409 MB MOV run accepted the fast overlap path end to end. `inject` proved upload start and exited; `prefill` then filled the description, sanitized short title, same-day 13:00 schedule, `含AI生成内容`, no-product intent, and fixed form defaults while the browser upload continued; `wait_upload` later returned `READY`. No post-upload mutation was needed, independent verification returned `READY`, and the final guard remained armed with zero attempts. No final publish control was clicked.

A later real 116 MB MP4 run exercised `wechatLink: { type: "product", selection: "first" }`. The initial implementation correctly opened link type `商品` but stopped at `选择需要添加的商品`; this exposed and repaired an overly permissive product gate. The maintained flow then opened the product table, selected its first eligible row (`GPT实战营…`, ID `10000828419925`), clicked `添加(1)`, kept the default five-second appearance timing, and confirmed it. Strict verify found the exact product title in the main link section, and an immediate mutate rerun was a no-op. No final publish control was clicked.

That uploaded editor also exposed the account's `.declare-original-checkbox`. With no current-run originality request, the package resolved `wechatOriginal: false`; live verify recorded `expected:false`, `enabled:false`, and `found:true`, and no original control or dialog was clicked. The opt-in true path is permission-gated and unit-tested but was not live-mutated in this run.

Later on 2026-08-26, a real 435 MB 1080×1920 run used the persistent `prepare` path and reached READY plus independent verify in about 25 seconds. The page proved same-day 15:00 scheduling, `含AI生成内容`, originality enabled, no product, and every pre-publish gate. After the user explicitly replaced the stop-at-READY policy, a one-time migration removed the old version-1 page guard and clicked the real in-view `发表` button; the live page returned the exact visible success signal `已发表` without a confirmation dialog. The new version-2 maintained publish phase and standing private policy are covered by the full automated suite; a subsequent no-op live phase check stopped at task ownership because the user had ended the task, so it was not retried.
