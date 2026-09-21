#!/usr/bin/env bash
# Restart all four local dev servers (API + three gold UIs), detached.
# Usage: bun run restart   (from repo root Alkemart4/)
# Docs: docs/architecture/workers/LOCAL-DEV.md
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORTS=(8787 5175 3002 3001)
LOG="/tmp/alkemart-dev.log"

pids_on_ports() {
  ss -tlnp 2>/dev/null \
    | grep -E ":(8787|5175|3001|3002) " \
    | grep -oP 'pid=\K[0-9]+' \
    | sort -u || true
}

echo "Stopping old servers (ports ${PORTS[*]})…"
for pid in $(pids_on_ports); do
  if kill -0 "$pid" 2>/dev/null; then
    echo "  killing pid $pid ($(ps -o comm= -p "$pid" 2>/dev/null || echo '?'))"
    kill "$pid" 2>/dev/null || true
  fi
done

# Give workerd/vite a moment to release the ports, then force leftovers.
for _ in $(seq 1 10); do
  [ -z "$(pids_on_ports)" ] && break
  sleep 1
done
for pid in $(pids_on_ports); do
  echo "  force-killing pid $pid"
  kill -9 "$pid" 2>/dev/null || true
done
sleep 1

if [ -n "$(pids_on_ports)" ]; then
  echo "ERROR: ports still held after kill: $(pids_on_ports | tr '\n' ' ')" >&2
  exit 1
fi

# dev-workers.sh validates .dev.vars + Hyperdrive env and blocks on `wait`,
# so launch it detached under nohup.
echo "Starting servers (log: $LOG)…"
nohup bash scripts/dev-workers.sh > "$LOG" 2>&1 &
echo "  supervisor pid $!"

# Wait for all four ports to answer, then report.
echo "Waiting for readiness…"
ready=0
for _ in $(seq 1 60); do
  ready=0
  curl -sf -m 2 http://127.0.0.1:8787/health >/dev/null 2>&1 && ready=$((ready + 1))
  for p in 5175 3002 3001; do
    curl -sf -m 2 -o /dev/null http://127.0.0.1:$p/ >/dev/null 2>&1 && ready=$((ready + 1))
  done
  [ "$ready" -eq 4 ] && break
  sleep 2
done

echo ""
echo "API        → http://127.0.0.1:8787  ($(curl -s -m 3 http://127.0.0.1:8787/health || echo 'NOT READY'))"
for spec in "5175:Storefront" "3002:Vendor" "3001:Admin"; do
  p="${spec%%:*}"; n="${spec##*:}"
  code="$(curl -s -m 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:$p/ 2>/dev/null || echo 000)"
  printf '%-11s→ http://127.0.0.1:%s  (HTTP %s)\n' "$n" "$p" "$code"
done

[ "$ready" -eq 4 ] || { echo "WARNING: not all servers ready — see $LOG" >&2; exit 1; }
echo "All four servers up."
