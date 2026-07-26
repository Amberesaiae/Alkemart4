#!/usr/bin/env bash
set -euo pipefail

# Setup Sentry monitoring for Alkemart.
# Run this after creating a Sentry project at sentry.io.
#
# 1. Go to sentry.io → Create new project → JavaScript
# 2. Copy the DSN (format: https://...@sentry.io/...)
# 3. Run this script with the DSN

if [ $# -lt 1 ]; then
  echo "Usage: $0 <SENTRY_DSN>"
  echo ""
  echo "Get your DSN from sentry.io → Project Settings → Client Keys (DSN)"
  exit 1
fi

SENTRY_DSN="$1"
export PATH="$HOME/.npm-global/bin:$PATH"

echo "=== Setting Sentry DSN on Railway ==="
railway variable set \
  --service alkemart-api \
  --environment production \
  "SENTRY_DSN=$SENTRY_DSN" \
  --skip-deploys 2>&1

echo ""
echo "=== Sentry Config Set ==="
echo "Backend will report to Sentry on next deploy."
echo ""
echo "NOTE: Frontend Sentry requires VITE_SENTRY_DSN in Vercel env vars."
echo "Add this to your Vercel project settings:"
echo "  VITE_SENTRY_DSN=$SENTRY_DSN"
