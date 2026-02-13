#!/usr/bin/env bash
set -euo pipefail

LOG_DIR=".logs"
mkdir -p "${LOG_DIR}"

MAX_LOG_BYTES=$((200 * 1024 * 1024))
KEEP_LOG_FILES=20

prune_old_logs() {
  local files=()
  while IFS= read -r file; do
    files+=("${file}")
  done < <(ls -1t "${LOG_DIR}"/tauri-dev-*.log 2>/dev/null || true)

  if (( ${#files[@]} > KEEP_LOG_FILES )); then
    for ((i = KEEP_LOG_FILES; i < ${#files[@]}; i++)); do
      rm -f "${files[$i]}"
    done
  fi

  local total_bytes
  total_bytes=$(du -sk "${LOG_DIR}" | awk '{print $1 * 1024}')
  while (( total_bytes > MAX_LOG_BYTES )); do
    local oldest
    oldest=$(ls -1tr "${LOG_DIR}"/tauri-dev-*.log 2>/dev/null | awk 'NR==1 { print; exit }')
    [[ -n "${oldest}" ]] || break
    rm -f "${oldest}"
    total_bytes=$(du -sk "${LOG_DIR}" | awk '{print $1 * 1024}')
  done
}

prune_old_logs
STAMP="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="${LOG_DIR}/tauri-dev-${STAMP}.log"
echo "writing dev logs to ${LOG_FILE}"
echo "retention: ${KEEP_LOG_FILES} files, ${MAX_LOG_BYTES} bytes total"
echo "stop with Ctrl+C"

npm run tauri dev 2>&1 | tee "${LOG_FILE}"
