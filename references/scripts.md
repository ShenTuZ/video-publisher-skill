# Production And Diagnostic Commands

All paths below are relative to the skill directory.

## Configuration

Inspect onboarding state before any other command:

```bash
node scripts/config.mjs status
node scripts/config.mjs validate
```

Run onboarding as documented in `references/configuration.md`. Set `VIDEO_PUBLISHER_CONFIG` to test or use an alternate per-user configuration file.

## Package Validation

Run once for every selected platform:

```bash
node scripts/check-package.mjs <platform> /absolute/path/to/package.json
```

Supported platform keys:

```text
xiaohongshu
douyin
wechat_channels
```

Validation checks the local video path, title limits, required platform fields, package-supplied Douyin topics, WeChat short title/publish mode/link intent/AI decision, and any requested cover paths and ratios. For MP4/M4V/MOV it reports duration from ISO BMFF metadata without `ffprobe`; Douyin content above the real-tested 900-second boundary, plus a maximum 0.1-second allowance for container rounding, fails with `DOUYIN_DURATION_LIMIT` before browser work. In a mixed-platform production run, the orchestrator records the invalid platform as `PLATFORM_REJECTED_ASSET` and continues every other platform that passed preflight.

Scheduled package times must be real local datetimes strictly later than the host's current time. A past or impossible calendar time is rejected before any creator page opens.

## Production Orchestrator

```bash
scripts/run-fast-platforms.sh \
  /absolute/path/to/package.json \
  task-suffix \
  xiaohongshu douyin wechat_channels \
  --publish-on-ready
```

This is the normal publishing command. Use `--stop-at-ready` only when the user explicitly requests a reviewable draft instead of publication.

Before upload input, the runner performs two serial read-only browser-health inspections for every selected platform, so only one Ego runtime probe is active at a time. A page-status RPC gets up to three short retries before becoming `INPUT_CHANNEL_BROKEN`. This entry detects that typed blocker from the current attempt's state history and retries the same stateful job after 5 seconds, 10 seconds, and one final 30-second cooldown. It never reinjects an active upload; after the automatic recoveries are exhausted it exits with the saved state and no unverified final publish.

Short interactive phases (`inspect`, `inject`, `prefill`, `mutate`, `verify`, and `publish`) also terminate their own unresponsive Ego process group after a bounded phase timeout and record the same typed blocker. Long upload/prepare phases retain a 20-minute bound.

When onboarding has `declarations.originalityPolicy: all_videos_original`, the runner applies truthful original/self-made declarations without another flag. With the generic `ask_each_run` policy, add `--confirm-original-rights` only after the user confirms the current video; this one-run override is not persisted. Read-only `--inspect-only` never needs either signal.

The platform list is optional; omit it to select every configured default platform. If the second positional argument is a platform key, the task suffix defaults to `manual`.

Read-only inspection:

```bash
scripts/run-fast-platforms.sh \
  /absolute/path/to/package.json \
  task-suffix \
  xiaohongshu wechat_channels \
  --inspect-only
```

Options:

```text
--inspect-only
--confirm-original-rights
--state-root <dir>
--job-id <id>
--check-concurrency <positive integer>
--upload-concurrency <positive integer>
```

UI concurrency is fixed at `1` and has no public override.

State defaults to `~/.video-publisher/v2-jobs/<job-id>/`. The job stores the package fingerprint, numeric task-space ids, exact stable task-space names, task-space-bound receipts, observations, compact verdicts, an atomic one-generation `state.backup.json`, and schema-`2` receipt checkpoints under `checkpoints/`. An invalid primary state may recover only from a fingerprint-matching backup; the corrupt file is preserved as `state.corrupt-<timestamp>.json`, after which all platform gates are read again.

Before state or browser work, production acquires `~/.video-publisher/v2-jobs/.publisher/orchestrator.lock/owner.json`, then `<job-dir>/orchestrator.lock/owner.json`. The first permits only one video publishing job under the state root while preserving parallelism across the three supported platforms inside that job; the second protects its persisted state. A simultaneous different job or duplicate invocation exits immediately. Normal completion removes both locks; a later run removes a stale lock only when the recorded owner PID is dead.

To resume an interrupted run, repeat the same command with the same `--job-id`. The package fingerprint must match. The orchestrator reuses a persisted task space only when both its numeric id and exact stable name identify the same live space; this prevents Ego's post-crash numeric-id recycling from entering another job. It restores only checkpoints whose platform, package fingerprint, and task-space id all match, then inspects page truth again before acting. If the recorded id is missing or has another live name, the runner selects or recreates only the recorded exact platform-space name and writes its current id back. An explicit recreation invalidates receipts even when Ego assigns the replacement the same numeric id. Ownership or user-control errors never use this fallback.

`INPUT_CHANNEL_BROKEN` is invocation-wide. Once any parallel runner records it, the orchestrator waits for sibling runners, skips every later UI mutation, and performs only final read-only verification. The next ordinary same-job invocation resumes after Ego restarts; do not manually clean state or re-run a one-platform mutator inside the broken invocation.

Exit codes:

```text
0: every selected platform is ready, or read-only inspection completed
10: at least one platform remains blocked or incomplete
1: fatal runner/parse/environment error
2: command usage error
```

## One-Platform Adapter Runner

Use only for adapter diagnosis and targeted repair:

```bash
node scripts/v2/run-platform.mjs \
  <platform> \
  /absolute/path/to/package.json \
  <inspect|prepare|inject|prefill|wait_upload|upload|mutate|verify|publish> \
  [task-suffix] \
  [numeric-task-space-id]
```

Direct Xiaohongshu `prepare`/`mutate` requires originality confirmation only when the package explicitly sets `xhsOriginal: true`. WeChat `prepare` and `mutate` likewise require it only when `wechatOriginal: true`; both default-false flows need no rights flag. `inspect`, `inject`, `prefill`, `wait_upload`, `upload`, and `verify` remain available without either signal. Use `prepare` only for bounded Xiaohongshu-only or WeChat-only diagnosis; the production orchestrator selects it automatically.

Direct `publish` requires `--confirm-final-publish` and is intended for the production orchestrator after READY. The production entry accepts `--publish-on-ready` to enable it for one run and `--stop-at-ready` to override a standing personal auto-publish policy.

For a verify call that must check a custom-cover receipt, pass the persisted receipt JSON:

```bash
VIDEO_PUBLISHER_V2_RECEIPTS='{"cover":{...}}' \
  node scripts/v2/run-platform.mjs xiaohongshu package.json verify suffix 12
```

## Result Contract

The adapter runner prints one line prefixed with:

```text
VIDEO_PUBLISHER_V2_RESULT:
```

Parsers accept the prefix only at the start of a trimmed output line. An exception message that merely mentions the prefix is not a result and must preserve the underlying runner error.

The payload includes:

```text
platform and phase
taskSpaceId
fresh gate evidence
typed blocker, when present
cover receipts, when produced
finalPublishClicked: false before READY; true only for an authorized publish phase
publishReceipt with confirmed platform success when phase is publish
optional timing with startedAt, finishedAt, and durationMs
```

Do not parse unstructured page logs as success.

## Tests

Run local validation without opening creator pages:

```bash
node --check scripts/v2/publisher.mjs
node --check scripts/v2/run-platform.mjs
for file in scripts/v2/platforms/*.mjs scripts/v2/ego/*.mjs scripts/v2/lib/*.mjs; do node --check "$file"; done
node --test scripts/tests/*.test.mjs scripts/v2/tests/*.test.mjs
```

These tests do not replace real platform acceptance.
