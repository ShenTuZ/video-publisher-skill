# Xiaohongshu Adapter Contract

Read `platform-common.md` and `ego-browser-workflow.md` first.

## Account Defaults

```text
short title, maximum 20 codepoints
concise per-video description
3-5 real topic entities
原创声明 off unless explicitly requested for the current video
platform cover, PK cover off
no chapters, collection, location, other components, or activities
public visibility
immediate publishing unless a time is explicit
READY-triggered final publish when authorized
```

## Upload And Identity

Use the confirmed video file. Reuse an uploaded editor only when the filename or expected title identifies this package. A different active draft is a blocker.

Use split `inject`, `prefill`, and `wait_upload` phases. After file injection proves visible upload progress, fill title, description, real topics, declarations, visibility, and timing while the browser transfer continues. `wait_upload` uses lightweight one-second probes and three consecutive completion samples. Post-upload `mutate` remains an idempotent repair and cover step.

When Xiaohongshu is the only selected platform, one persistent `prepare` runner performs those logical phases in the same Ego process, followed by a separate `verify` process. Never reinject an active matching upload.

## Topic Entities

Clear the body editor completely, insert the exact concise description, and create a separate topic paragraph with real Enter keys. Then add topics one at a time through the real suggestion panel. The sticky final-publish footer can cover the visually exposed toolbar near the viewport bottom, so a pointer click may land on the footer instead of `话题`. Invoke the exact native `button.contentBtn.topic-btn` control through its page handler to make the platform editor insert `#`, explicitly refocus the editor at its end, type only the compact topic query, and select the exact suggestion row. Do not inject `#话题` as one text operation; that can create a suggestion decoration without loading candidates on a cold page.

Under sustained browser load, the decoration may appear while the candidate panel remains empty. Verify the exact trailing query, poll the exact row for a finite extended window, and if it never appears clear the entire topic editor and retry the whole requested set. Use at most three whole-set attempts; never preserve a half-built set or accept plain text after an empty candidate response.

Candidate appearance and committed-anchor verification use bounded 200ms state polling. Do not restore the former fixed 1.2-second waits around every topic.

After an Ego restart, the selected Xiaohongshu tab may report `document.visibilityState: hidden` even though its DOM is readable. Hidden-page timer throttling can delay a real topic candidate response far beyond the bounded wait. Immediately before a serialized topic rebuild, bring the page to front, set its web lifecycle to `active`, enable focus emulation, and prove `visible` plus `document.hasFocus()`. Do not add longer blind waits to compensate for a hidden lifecycle.

Spaces terminate Xiaohongshu topic input. When a readable package label contains whitespace, query the compact form (for example `AI Agent` -> `AIAgent`) and accept it only when the committed entity's `data-topic.name`, normalized without whitespace, matches the requested label. Preserve the readable package label in evidence. Never accept compact plain text as a substitute for an entity.

The verifier must prove:

- every requested topic exists as a committed entity;
- the remaining plain text equals the exact expected description;
- no requested topic remains as plain text;
- no malformed or duplicate entity exists;
- no stale body residue remains when the package has no prose body.

Do not insert `.tiptap-topic` HTML manually.

## Original Declaration

Default `xhsOriginal` to false. When false, keep `原创声明` disabled and do not open its agreement dialog. If a reused matching editor is unexpectedly enabled, turn it off and verify the disabled state.

Only when the current video explicitly sets `xhsOriginal: true`, open `内容设置`, enable `原创声明`, accept the agreement checkbox when a dialog appears, and click the dialog’s `声明原创` control. That dialog control is not the final publish button, and true still requires the standing rights policy or current-run confirmation.

Verify the exact expected toggle state from a fresh inspection. A click attempt is insufficient.

## Fixed Optional Settings

- Keep PK cover disabled and use the platform-selected first-frame/default cover unless a custom 3:4 asset is explicitly supplied.
- Leave chapters and collection unselected.
- Leave location, group chat, referenced note, live preview, tagged friend/location, and route untouched.
- Do not associate any activity.
- Require `公开可见`.

## Content Type And Timing

Default the content-type declaration to empty. When `xhsAiGenerated: true`, select the exact live option `笔记含AI合成内容`; do not substitute the fiction, marketing, or source declarations.

Default `xhsPublish.mode` to `immediate` and keep the `定时发布` switch off. For `scheduled`, enable it, write the exact `YYYY-MM-DD HH:mm` value through the real date-picker input, and verify both the switch and value.

## Final Publish

The bottom final control is exposed reliably through Ego's semantic tree, not ordinary page DOM; the left navigation also says `发布笔记` and must never satisfy the final-button gate. Match only the semantic bottom button `发布` or `定时发布`. After every pre-publish gate independently reaches READY and automatic publishing is authorized, click that semantic control and require the success-page URL or the exact visible signal `发布成功`.

## Custom Cover

Default to the platform cover unless the package explicitly enables an existing-cover upload. Use the user-provided `3:4` asset.

The tested editor entry is the real preview control under `.default.row` or `.default.column`. Open it with a real browser click, then poll for a visible `上传封面` tab instead of assuming a fixed render delay; one clean reopen is allowed when the asynchronous dialog does not materialize. Upload through the image input, choose the crop ratio matching the asset when exposed, and confirm the editor.

Accept the cover only when the main editor exposes the uploaded preview URL, normally on `ros-preview.xhscdn.com`, and no cover dialog blocks the page. Store that URL in the receipt and require the verify phase to find it again.

## Required Gates

```text
authenticated
correct draft identity
video fully uploaded
exact title
exact concise description
exact topic entities with no plain residue
原创声明 matches explicit `xhsOriginal`, default false
PK cover off
content type empty or `笔记含AI合成内容` according to `xhsAiGenerated`
chapters, collection, components, and activities remain unselected
public visibility
exact immediate/scheduled state and time
custom 3:4 receipt when enabled, otherwise default cover state
no blocking dialog
visible enabled 发布 button
visible enabled `发布笔记` final button; final publish not clicked
```

This path passed real pre-publication runs on 2026-07-14 and 2026-07-15. The visible-tab polling path was fault-tested by discarding the receipt and re-uploading the same 3:4 asset. Later 731 MB and 533 MB runs survived orchestrator termination during upload without reinjection, and the 533 MB run verified whitespace-normalized topic lookup plus three no-op full reruns. Real Ego Lite crash/restart and sustained-load runs reproduced both the cold-page topic-decoration failure and an empty candidate panel. A mutation-stage crash finally proved the persistent failure was hidden lifecycle throttling: activating and focusing that exact failed page made its next bounded whole-set rebuild commit four entities on attempt one. The 3:4 receipt and three-platform `READY` state were restored, followed by three full no-op reruns.

On 2026-08-26, a real 435 MB video run verified the current interface defaults and repaired two new regressions: `unchecked` must not be substring-matched as `checked`, and description text needs real paragraph breaks before native topic entry. The maintained adapter then verified exact description, four real topics, `笔记含AI合成内容`, originality/PK/schedule off, platform cover, no optional components or activities, and public visibility. A no-op orchestrator rerun performed no upload or mutation and returned READY. The authorized publish phase then clicked only the bottom semantic `发布` control, received `发布成功`, and verified the `/publish/success` URL.

A subsequent real 201.6 MB 1080×1920 run accepted the persistent overlap path end to end in about 36.7 seconds. `uploadStart` recorded `mode: injected` at 0%; exact title, concise description, four native topic entities, non-AI/no-original defaults, and every optional-setting gate were already verified while upload remained at 36% with roughly 19 seconds left. Lightweight completion wait, independent verify, and automatic publish then returned `发布成功` and the success URL. No reinjection or post-upload metadata repair occurred.

A later real two-platform 230.5 MB run proved Xiaohongshu and WeChat Channels can inject in parallel, prefill serially while both transfers continue, wait and verify in parallel, and publish from one shared job. Xiaohongshu returned `发布成功`; its terminal published state is protected from all later retry phases when the other platform still needs recovery.

For the 82 MB optimization sample, the final stable code reached dual-platform READY in about 30 seconds with Xiaohongshu native topics complete. Combined with the same sample's measured 9.2-second serial publish stage, the healthy equivalent end-to-end path is about 39.2 seconds.
