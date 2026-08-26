---
name: video-publisher
description: Prepare and automate video drafts for Xiaohongshu, Douyin, and WeChat Channels with Ego Lite. Use for onboarding, video intake, copy and tags, upload scheduling, WeChat product links and AI labels, draft recovery, original declarations, existing-cover upload, workflow extensions, and verification before final publish.
---

# Video Publisher

Prepare one confirmed video package and drive selected creator platforms to a verified draft state. Use Ego Lite for all live creator-page work.

## Configuration And Onboarding

At the start of every invocation, before inspecting a video or opening a browser, run:

```bash
node scripts/config.mjs status
```

If `onboardingRequired` is `true`, stop the publishing flow and onboard the user. Ask which of Xiaohongshu, Douyin, and WeChat Channels the user actually has; require at least one and never assume all three. Then ask which available platforms should run by default, proposing all available platforms. Ask for Douyin topics only when Douyin is available. Ask about reusable originality policy only when Xiaohongshu is available. WeChat originality is always per-video opt-in and never a standing default. Collect the source directory and shared copy/tag preferences. Keep check/upload concurrency `4/4` and platform-default covers as proposed defaults unless the user changes them. Summarize before writing, save available accounts with repeatable `--available-platform` flags and defaults with repeatable `--platform` flags, run `validate`, and continue only when onboarding is complete.

Configuration is per user at `$XDG_CONFIG_HOME/video-publisher/config.json`, or `$HOME/.config/video-publisher/config.json`. `VIDEO_PUBLISHER_CONFIG` overrides the path. Never store personal configuration in the shareable Skill folder.

Current-run instructions override package fields; package fields override configuration defaults. A request may select any configured available platform but must not silently add an unavailable one. Never persist cookies, credentials, or video-specific paths. Persist `execution.autoPublishOnReady` only when the user explicitly requests a standing READY-to-publish policy. `execution.publishProfile` defaults to `fast`; use `--strict` only for first-page adaptation, a blocked platform, or a user-requested full diagnostic. Read `references/configuration.md` for the schema and onboarding command.

## Safety Boundary

Default to stopping before the final `发布`, `发布笔记`, or `发表` control. A current-run `--publish-on-ready` instruction or an explicitly configured `execution.autoPublishOnReady: true` authorizes the maintained runner to publish each platform as soon as that platform independently reaches `READY`; a pending, blocked, or failed sibling does not delay it. Until then, the page-level capture guard remains armed; `READY` requires `guardArmed: true`, `blockedAttempts: 0`, and `finalPublishClicked: false` from fresh page evidence. The later `publish` phase receives a separate orchestrator authorization, permits the exact final action, and requires platform success evidence.

Xiaohongshu defaults to `xhsOriginal: false` and WeChat defaults to `wechatOriginal: false`. Only an explicit current-video instruction may set either field to true; true requires the applicable standing policy or current-video confirmation before browser mutation. Never infer originality from the video. Originality remains separate from the optional READY-to-publish policy.

Stop only when every selected platform is either ready from fresh evidence or blocked by a typed condition that genuinely requires the user or a later retry. An attempted action is not success; title, tags, declarations, settings, and covers count only after verification.

## Production Architecture

Use the stateful production entry:

```bash
scripts/run-fast-platforms.sh <package.json> [task-suffix] [platform...]
```

This invokes `scripts/v2/publisher.mjs`. Use one orchestrator and one Ego Lite task space per platform. Do not delegate live creator-page control to sub Agents.

The publisher acquires a state-root publisher lock and an atomic job-directory lock before state or browser work. Only one video job may control the shared creator accounts at a time. Stale dead-PID locks may be recovered automatically; per-platform locks remain as defense in depth.

Schedule by resource type:

```text
browser health inspect: two consecutive serial read-only passes, one shared Ego channel
file injection and upload-start proof: serial start in fast mode, then concurrent browser uploads
metadata and settings while browser uploads continue: serial, exactly 1
upload completion wait: parallel, read-only
post-upload repair, declarations, and covers: serial, exactly 1
final verification: parallel, default 4
```

Before an upload input is touched, every selected platform must pass two fresh serial health inspections in its persisted task space. This avoids concurrent Ego runtime probes; each page-status RPC also receives up to three bounded short retries before the channel is treated as broken. Short interactive phases have an owned-process watchdog, while upload-wait phases retain a long bounded limit. Xiaohongshu activates page lifecycle before writing title or topic entities during upload, then requires visible responsive controls without treating an isolated-page focus flag as a failure. Fast adapters then split upload into `inject` and `wait_upload`. Fast mode starts injections serially because Ego's input channel is shared, but each browser upload continues in the background while one serial UI controller fills metadata; completion waiters remain parallel and read-only. Never run two input controllers at once or reinject an active upload. If any runner returns `INPUT_CHANNEL_BROKEN`, wait for siblings, skip remaining mutation, and run only final read-only verification. `run-fast-platforms.sh` automatically retries the same persisted job after 5 seconds, 10 seconds, and a final 30-second cooldown, only for that typed blocker; after those automatic recoveries it stops without publishing an unverified platform.

When Xiaohongshu or WeChat Channels is the only selected platform, use its persistent `prepare` runner. One Ego process inspects, injects, prefills while upload continues, waits, and repairs the draft; a separate read-only `verify` runner must still re-read every gate. Multi-platform jobs retain the split phase scheduler so one platform never blocks the others.

Persist the exact task-space name with its numeric id. A recycled id whose live name differs belongs to another job. Accepted cover receipts use atomic fingerprint- and task-space-bound checkpoints. State keeps a one-generation atomic backup; a corrupt primary may recover only from a fingerprint-matching backup and still requires fresh verification.

Each persisted phase history may include backward-compatible `timing` evidence with `startedAt`, `finishedAt`, and `durationMs` for performance regression analysis.

## Browser Rules

- Use `ego-browser`; do not fall back to Chrome control.
- Verify exact local video and cover paths before opening creator pages.
- Reuse a draft only when its identity matches the package.
- Close task spaces after confirmed formal publication; leave them open only for a user-requested reviewable draft or required human action.
- If Ego reports user takeover, stop all browser work and resume only after explicit confirmation.

Read `references/ego-browser-workflow.md` before browser diagnosis or adapter changes.

## Custom Workflow Extensions

When the user asks to add, remove, reorder, or customize a publishing step, read `references/customizing-workflows.md` before editing. Implement an idempotent `inspect -> action -> verify` step backed by real page evidence. Never let customization bypass final-publish authorization, truthful originality policy, task-space ownership, or the safety gate.

## Phases And Evidence

The platform runner exposes only:

```text
inspect: read page truth without mutation
prepare: persistent single-platform Xiaohongshu/WeChat inspect/inject/prefill/wait/repair
inject: inject the file and exit after proving upload started
prefill: serially fill metadata while the browser upload continues
wait_upload: read-only wait for stable upload completion
upload: legacy combined inject-and-wait for adapters not yet split
mutate: repair remaining post-upload fields, declarations, settings, and covers
verify: independently re-read every required gate
publish: after READY only, authorize the guarded final action and verify success
```

`ready` is computed centrally. Fast mode requires authentication, correct draft identity, completed upload, exact text/topic entities, explicitly requested declarations/settings, no blocking dialog, an enabled final button, and an armed safety guard. It skips untouched default-item gates and the redundant final full-page verification. Strict mode retains every gate and repair. Read `references/platform-common.md` for the gate and blocker contract.

## Content Package

Use onboarded configuration as defaults and build the package autonomously from the exact source plus its sidecar transcript/captions. Do not ask the user to approve generated title, description, tags, or the configured platform set before browser work; report the resolved package as progress instead. Pause only for a material unresolved choice: exact source ambiguity, an originality declaration, a scheduled video without an exact time, a product request without a first-row instruction or exact search target, a requested custom cover without its asset, or authentication/risk-control/user-control state. Newlines in JSON fields must be real newline characters.

Platform-native defaults:

```text
Xiaohongshu: title up to 20 characters, concise description, 2-3 real topic entities by default, originality off unless explicitly requested
Douyin: title/body plus 2-3 package-supplied topic entities by default, platform cover, no extra activities/components, public visibility, downloads allowed, and immediate publish unless `douyinPublish` explicitly requests a time
WeChat Channels: description and sanitized short title are prefilled before upload; location is preserved, collection is untouched, and activity remains “不参与活动”
```

This Skill does not create or edit cover artwork. When the user supplies existing cover files and explicitly enables `cover.uploadCustomCover: true`, validate:

```text
Xiaohongshu: 3:4
Douyin: 3:4 and 4:3
WeChat Channels: 3:4 and 4:3
```

Run `scripts/check-package.mjs` for every selected platform before browser work. For Douyin, reject content materially longer than 900 seconds before Ego starts, allowing only 0.1 seconds of container-metadata rounding. Do not automatically trim, transcode, or substitute media. Other eligible selected platforms may continue.

WeChat Channels uses a fixed default template. When the user does not mention a field, resolve it as:

```json
{
  "wechatShortTitle": "semantic summary, target at most 10 characters",
  "wechatPublish": { "mode": "immediate" },
  "wechatLink": { "type": "none" },
  "wechatAiGenerated": false,
  "wechatOriginal": false
}
```

Xiaohongshu uses this fixed template unless the current request explicitly overrides a field:

```json
{
  "xhsDescription": "concise per-video description",
  "xhsTopics": ["3-5 real topic entities"],
  "xhsOriginal": false,
  "xhsAiGenerated": false,
  "xhsPublish": { "mode": "immediate" }
}
```

Douyin uses this fixed template unless the current request explicitly overrides a field:

```json
{
  "douyinAiGenerated": false,
  "douyinPublish": { "mode": "immediate" }
}
```

When the user says AI content is involved, set `douyinAiGenerated: true` and select the exact `内容由AI生成` declaration. Douyin has no original-content control, so originality instructions apply only to Xiaohongshu and WeChat Channels; do not map them to Douyin's autonomous declaration.

Keep the platform-default cover, PK cover off, no chapters/collection/location/components/activities, and public visibility. When the user explicitly says the video contains AI-generated content, set `xhsAiGenerated: true` and select `笔记含AI合成内容`. For scheduled publishing use `xhsPublish: { "mode": "scheduled", "publishAt": "YYYY-MM-DD HH:mm" }`.

Only explicit current-run instructions override this template. For scheduled videos, use `wechatPublish: { "mode": "scheduled", "publishAt": "YYYY-MM-DD HH:mm" }`. For product-linked videos, use either `wechatLink: { "type": "product", "selection": "search", "query": "product name or id", "expectedName": "exact visible product name" }` or `wechatLink: { "type": "product", "selection": "first" }` when the user explicitly requests the first available product. Set `wechatAiGenerated: true` only when the user says the video contains AI-generated content. Set `wechatOriginal: true` only when the user explicitly says to add/declare originality; otherwise leave the control unchecked. If the product entry or first selectable row is unavailable, return a blocker instead of selecting another link type.

Generate a meaningful WeChat short-title summary of at most 10 Unicode characters. The platform hard limit is 16 characters. Before validation and form filling, keep Unicode letters, numbers, and spaces; remove punctuation, emoji, hashtags, and other symbols; then safely cap the fallback at 10 characters. Fail package validation if nothing remains.

## Default Flow

1. Load configuration and complete onboarding when required.
2. Identify the exact source and any subtitle variant.
3. Build each platform package from its fixed defaults, apply only the user's explicit changes, then confirm the package and selected platforms.
4. Validate supplied cover assets and every platform package.
5. Resolve title, descriptions, short title, and real topics from the source context without requesting approval when no material choice is unresolved.
6. Run two fresh browser-health inspections before any upload injection.
7. For Xiaohongshu-only or WeChat-only work, run one persistent prepare session; otherwise serially start missing uploads and prove each fast upload has started.
8. While browser uploads continue, fill metadata through one serial UI controller.
9. Wait for upload completion in parallel without further input, then repair remaining post-upload fields and covers.
10. In fast mode, publish each READY platform immediately; run a full independent verification only under `--strict`.
11. On a shared Ego input-channel failure, retry only the same persisted job with bounded 5-second, 10-second, and 30-second backoff; stop after that limit.
12. After confirmed formal publication, close the isolated task spaces unless the user asked to review the live page. Stop at READY only when the user explicitly requests a draft/reviewable run.

Read-only inspection:

```bash
scripts/run-fast-platforms.sh <package.json> [task-suffix] [platform...] --inspect-only
```

Use `scripts/v2/run-platform.mjs` only for bounded one-platform diagnosis as documented in `references/scripts.md`.

## Acceptance Boundary

Automated tests validate configuration, package parsing, scheduling barriers, persistence, locking, and central gate evaluation. Only a real logged-in creator-page run can accept live selectors, topic entities, declarations, settings, uploads, and covers. Never represent unit-test success as live-platform acceptance.

## Reference Map

- `references/intake-workflow.md`: source selection and package drafting.
- `references/configuration.md`: per-user schema, onboarding, precedence, and privacy.
- `references/cover-workflow.md`: existing-cover mapping and receipts.
- `references/ego-browser-workflow.md`: task spaces, upload channels, handoff, and diagnostics.
- `references/platform-common.md`: orchestration, gates, blockers, and concurrency.
- `references/scripts.md`: production and diagnostic commands.
- `references/platform-xiaohongshu.md`: Xiaohongshu adapter contract.
- `references/platform-douyin.md`: Douyin adapter contract.
- `references/platform-wechat-channels.md`: WeChat Channels adapter contract.

Default source directory comes from configuration; `VIDEO_PUBLISHER_SOURCE_DIR` may override it for `find-video.mjs`.
