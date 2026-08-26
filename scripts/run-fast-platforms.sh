#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <package.json> [task-suffix] [platform...] [options]" >&2
  echo "Fast stateful runner: inspect -> inject -> overlap prefill -> upload wait -> post-upload repair -> verify." >&2
  exit 2
fi

exec node "${script_dir}/v2/publisher.mjs" "$@"
