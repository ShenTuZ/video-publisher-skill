# Intake Workflow

Start from a video link or local file path.

Before intake, read `node scripts/config.mjs status`. Use `sourceDirectory`, `availablePlatforms`, `defaultPlatforms`, `contentProfile`, platform defaults, and cover preference as proposals only. A current user instruction or explicit package field wins within `availablePlatforms`. If the user asks for an unavailable platform, update onboarding and confirm the account before any browser work.

## Video Input

```text
If it is a local absolute path, use it directly.
If it is a file:// URL, convert it to a local path.
If it is an HTTP(S) link, ask before downloading unless the link clearly points to a direct video file that the user wants published.
If the link points to an already-published creator platform post, treat it as a reference and ask for the source video file before uploading.
```

Before any browser upload, verify the local file exists with `ls -lh` or `test -f`, then run `scripts/check-package.mjs` for every selected platform. For Douyin, MP4/M4V/MOV content above the real-tested 15:00 boundary must be rejected before Ego Lite starts; allow at most 0.1 seconds of container-metadata rounding. Ask for a shorter export; never automatically trim or transcode the source. Continue validating the original file for any other selected platforms because this limit is Douyin-specific.

Default both `xhsOriginal` and `wechatOriginal` to false. Set the matching field true only when the user explicitly requests originality for the current video; true requires the applicable standing policy or current-video rights confirmation. Never infer eligibility from the filename or content. Treat originality separately from final-publish authorization.

If the exact path does not exist:

```text
1. Stop browser work for that file.
2. Search the source directory for nearby names, for example `*pet*skill*subtitled*.mp4` or `*subtitled*.mp4`.
3. Tell the user the exact path was missing and show the nearest matches.
4. Do not silently fall back to a different video, even if the filename looks similar.
```

This matters because similarly named videos can share a title and topic package, but publishing the wrong local file is worse than pausing for clarification.

## Content Inspection

Before drafting title and tags, inspect the available context:

```text
Filename and nearby subtitle/caption variants
Sidecar subtitle files: .ass, .srt, .vtt
Embedded subtitle streams if sidecars are unavailable
Existing Xiaohongshu titles for similar content
Optional keyframe or video preview if the title is unclear
```

For `.ass` subtitles, read the `[Events]` `Dialogue:` lines and summarize the real topic before drafting.

## Title And Tag Style

Title should match the user's stated voice and the video's real content: clear, conversational, specific, and curiosity-friendly.

Avoid hard-selling, generic traffic bait, and exaggerated claims.

Tags should usually include 3-7 terms, mixing the subject, audience, product, and workflow when relevant. Treat configured `contentProfile.recurringTags` as candidates, not mandatory tags; include only terms relevant to the current video.

Douyin accepts 1-5 topic entities. Explicit package topics win; otherwise use configured `platforms.douyin.defaultTopics`. Confirm account campaigns during onboarding rather than embedding them in this Skill.

Neutral examples:

```text
主题名
工具名
教程
使用技巧
工作流
```

## Platform Text Defaults

Use platform-native text habits:

```text
Xiaohongshu: title + topic entities only. No prose description by default.
Douyin: title + short body if useful + package-supplied topic entities at the end.
WeChat Channels: description comes from the per-video content; generate a meaningful short-title summary targeting at most 10 characters, below the platform hard limit of 16. Preserve location, leave collection unselected, keep activity at `不参与活动`, default to `immediate`, `wechatLink.type: none`, `wechatAiGenerated: false`, and `wechatOriginal: false`. Apply only explicit user overrides.
```

Default cover behavior comes from `cover.uploadExistingByDefault`, which should normally be `false`. Do not create cover artwork. Upload an existing cover only after obtaining its file path for the current run.

Map user-supplied cover files this way:

```text
Xiaohongshu: 3:4 portrait
WeChat Channels: both 3:4 portrait and 4:3 landscape
Douyin: both 3:4 portrait and 4:3 landscape
```

## Proposal Shape

When the user has not provided title and tags:

```text
我先根据视频内容拟一个发布包：

视频:
建议标题:
建议 tags:
抖音 topics:
平台差异:

你觉得合适吗？可以直接改标题或 tag。
```

After the user approves title and tags, ask for platform selection from `availablePlatforms`, proposing `defaultPlatforms`. Mention that existing-cover upload is skipped by default.

## Final Package

Before browser form filling:

```text
视频:
标题:
统一关键词:
小红书 tags:
抖音描述:
抖音 topics:
视频号描述:
视频号 tags:
视频号短标题: 默认生成 10 字以内的语义摘要；平台硬上限 16 字；仅记录用户明确修改
视频号发布方式: 默认 `immediate`; 用户说定时时才改为 `scheduled` 并要求 `YYYY-MM-DD HH:mm`
视频号链接: 默认 `none`; 用户说带商品时改为 `product`; 支持按搜索词/ID精确选择，或在用户明确说“第一个”时使用 `selection: first`
视频号 AI 标注: 默认 `false`/`无需标注`; 用户明确说含 AI 生成内容时才改为 `true`
视频号原创: 默认 `false`; 用户明确说“加原创/声明原创”时才改为 `true`，并要求本次权利确认
视频号固定策略: 位置保持不变；合集不选择；活动为 `不参与活动`
封面: 使用平台默认封面；若本轮明确要求上传已有封面，则记录所需 3:4/4:3 文件路径
平台:
是否使用字幕版:
```
