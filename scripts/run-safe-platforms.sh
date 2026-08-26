#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <package.json> [task-suffix] [platform...] [options]" >&2
  echo "Compatibility runner: inspect -> fast inject/prefill -> upload wait -> post-upload repair -> verify." >&2
  exit 2
fi

exec node "${script_dir}/v2/publisher.mjs" "$@"
