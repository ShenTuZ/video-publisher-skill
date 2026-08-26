#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <package.json> [task-suffix] [platform...] [options]" >&2
  echo "Fast stateful runner: inspect -> inject -> overlap prefill -> upload wait -> post-upload repair -> verify." >&2
  exit 2
fi

recovery_delays=(5 10 30)
if [[ -n "${VIDEO_PUBLISHER_INPUT_RECOVERY_DELAYS:-}" ]]; then
  IFS=',' read -r -a recovery_delays <<< "${VIDEO_PUBLISHER_INPUT_RECOVERY_DELAYS}"
fi

for delay in "${recovery_delays[@]}"; do
  if ! [[ "$delay" =~ ^[0-9]+$ ]]; then
    echo "VIDEO_PUBLISHER_INPUT_RECOVERY_DELAYS must be comma-separated non-negative seconds" >&2
    exit 2
  fi
done

attempt=0
attempt_log=""
cleanup() {
  if [[ -n "$attempt_log" && -f "$attempt_log" ]]; then rm -f "$attempt_log"; fi
}
trap cleanup EXIT

while true; do
  attempt_started="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
  attempt_log="$(mktemp "${TMPDIR:-/tmp}/video-publisher-recovery.XXXXXX")"
  set +e
  node "${script_dir}/v2/publisher.mjs" "$@" 2>&1 | tee "$attempt_log"
  status=${PIPESTATUS[0]}
  set -e

  if [[ "$status" -eq 0 ]]; then exit 0; fi
  if [[ "$status" -ne 10 || "$attempt" -ge "${#recovery_delays[@]}" ]]; then exit "$status"; fi

  state_path="$(node -e 'const fs=require("fs");const text=fs.readFileSync(process.argv[1],"utf8");const matches=[...text.matchAll(/"statePath"\s*:\s*"([^"]+)"/g)];process.stdout.write(matches.at(-1)?.[1]||"");' "$attempt_log")"
  should_retry="$(node -e 'const fs=require("fs");try{const statePath=process.argv[1],since=Date.parse(process.argv[2]||"");if(!statePath||!Number.isFinite(since))process.exit(0);const state=JSON.parse(fs.readFileSync(statePath,"utf8"));const broken=Object.values(state.platforms||{}).some(item=>{const current=item?.verdict?.blocker?.code==="INPUT_CHANNEL_BROKEN"&&Date.parse(item?.lastObservedAt||0)>=since;const history=(item?.history||[]).some(event=>event?.blocker?.code==="INPUT_CHANNEL_BROKEN"&&Date.parse(event?.at||0)>=since);return current||history});process.stdout.write(broken?"1":"0")}catch{}' "$state_path" "$attempt_started")"
  if [[ "$should_retry" != "1" ]]; then exit "$status"; fi

  delay="${recovery_delays[$attempt]}"
  attempt=$((attempt + 1))
  rm -f "$attempt_log"
  attempt_log=""
  echo "[video-publisher-v2] shared Ego input channel failed; retrying the same job in ${delay}s (${attempt}/${#recovery_delays[@]})" >&2
  sleep "$delay"
done
