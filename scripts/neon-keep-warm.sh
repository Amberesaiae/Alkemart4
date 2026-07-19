#!/usr/bin/env bash
# Free-plan WORKAROUND only — not production best practice.
# Free_v3 forces ~5m scale-to-zero and blocks suspend_timeout=-1.
# Production: upgrade to Launch and disable scale-to-zero (see docs/NEON.md).
#
# Usage:
#   bash scripts/neon-keep-warm.sh              # one-shot wake + SELECT 1
#   bash scripts/neon-keep-warm.sh --loop       # every INTERVAL_SEC (default 240)
# Stop --loop when not developing (burns free CU-hours while compute stays active).
#
# Env:
#   NEON_PROJECT_ID  (default wispy-union-10280789)
#   NEON_BRANCH      (default medusa-prod)
#   NEON_DATABASE    (default alkemart_marketplace)
#   NEON_ENDPOINT_ID (default ep-restless-lab-at072v3y)
#   INTERVAL_SEC     (default 240)

set -uo pipefail

PROJECT_ID="${NEON_PROJECT_ID:-wispy-union-10280789}"
BRANCH="${NEON_BRANCH:-medusa-prod}"
DATABASE="${NEON_DATABASE:-alkemart_marketplace}"
ENDPOINT_ID="${NEON_ENDPOINT_ID:-ep-restless-lab-at072v3y}"
INTERVAL_SEC="${INTERVAL_SEC:-240}"

wake_once() {
  local ts
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  # Explicit start (no-op if already active)
  neonctl api "/projects/${PROJECT_ID}/endpoints/${ENDPOINT_ID}/start" -X POST >/dev/null 2>&1 || true
  # Real SQL traffic through pool so last_active advances
  if echo 'select 1 as warm;' | neonctl psql "${BRANCH}" \
      --project-id "${PROJECT_ID}" \
      --database-name "${DATABASE}" \
      -- -t >/dev/null 2>&1; then
    echo "[${ts}] neon warm ok project=${PROJECT_ID} branch=${BRANCH} db=${DATABASE}"
    return 0
  fi
  echo "[${ts}] neon warm FAILED" >&2
  return 1
}

if [[ "${1:-}" == "--loop" ]]; then
  echo "neon-keep-warm loop interval=${INTERVAL_SEC}s (Ctrl+C to stop)"
  while true; do
    wake_once || true
    sleep "${INTERVAL_SEC}"
  done
fi

wake_once
exit $?
