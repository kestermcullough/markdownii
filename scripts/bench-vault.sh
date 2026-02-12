#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "usage: scripts/bench-vault.sh <vault-path> [iterations]"
  exit 2
fi

VAULT_PATH="$1"
ITERATIONS="${2:-8}"

cargo run --manifest-path src-tauri/Cargo.toml --bin vault_bench -- "$VAULT_PATH" "$ITERATIONS"
