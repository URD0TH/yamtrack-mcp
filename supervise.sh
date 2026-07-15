#!/usr/bin/env bash
# Supervise yamtrack-mcp: restart on crash up to MAX_ATTEMPTS times, then exit.
set -u
MAX_ATTEMPTS="${YAMTRACK_MCP_MAX_RETRIES:-5}"
interval="${YAMTRACK_MCP_RETRY_INTERVAL:-2}"
attempt=0
while [ "$attempt" -lt "$MAX_ATTEMPTS" ]; do
  attempt=$((attempt + 1))
  echo "[supervise] $(date -u +%FT%TZ) attempt $attempt/$MAX_ATTEMPTS: starting yamtrack-mcp" >&2
  node "$(dirname "$0")/dist/index.js" "$@"
  code=$?
  if [ "$code" -eq 0 ]; then
    echo "[supervise] $(date -u +%FT%TZ) yamtrack-mcp exited cleanly; not retrying" >&2
    exit 0
  fi
  echo "[supervise] $(date -u +%FT%TZ) yamtrack-mcp died (exit $code); retrying in ${interval}s" >&2
  sleep "$interval"
done
echo "[supervise] $(date -u +%FT%TZ) max retries ($MAX_ATTEMPTS) reached; giving up" >&2
exit 1
