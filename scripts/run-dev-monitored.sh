#!/usr/bin/env bash
set -euo pipefail

mkdir -p .logs
STAMP="$(date +%Y%m%d-%H%M%S)"
LOG_FILE=".logs/tauri-dev-${STAMP}.log"

echo "writing dev logs to ${LOG_FILE}"
echo "stop with Ctrl+C"

npm run tauri dev 2>&1 | tee "${LOG_FILE}"
