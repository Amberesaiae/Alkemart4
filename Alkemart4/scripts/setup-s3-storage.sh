#!/usr/bin/env bash
set -euo pipefail

# Setup S3-compatible storage for Alkemart production.
# Run this after creating a Cloudflare R2 bucket (or Tigris/Backblaze B2).
#
# Cloudflare R2 (recommended - free tier):
#   1. Sign up at dash.cloudflare.com
#   2. Create R2 bucket named "alkemart-media"
#   3. Create API token with R2 read/write permissions
#   4. Run this script with the credentials

if [ $# -lt 4 ]; then
  echo "Usage: $0 <S3_ENDPOINT> <S3_ACCESS_KEY> <S3_SECRET_KEY> <S3_BUCKET> [S3_REGION]"
  echo ""
  echo "Examples:"
  echo "  # Cloudflare R2:"
  echo "  $0 https://<account-id>.r2.cloudflarestorage.com <access-key> <secret-key> alkemart-media auto"
  echo ""
  echo "  # Backblaze B2:"
  echo "  $0 https://s3.us-west-004.backblazeb2.com <access-key> <secret-key> alkemart-media us-west-004"
  echo ""
  echo "  # Tigris:"
  echo "  $0 https://fly.storage.tigris.dev <access-key> <secret-key> alkemart-media auto"
  exit 1
fi

S3_ENDPOINT="$1"
S3_ACCESS_KEY="$2"
S3_SECRET_KEY="$3"
S3_BUCKET="$4"
S3_REGION="${5:-auto}"

export PATH="$HOME/.npm-global/bin:$PATH"

echo "=== Setting S3 config on Railway ==="
echo "Endpoint: $S3_ENDPOINT"
echo "Bucket: $S3_BUCKET"
echo "Region: $S3_REGION"

railway variable set \
  --service alkemart-api \
  --environment production \
  "S3_ENDPOINT=$S3_ENDPOINT" \
  "S3_ACCESS_KEY_ID=$S3_ACCESS_KEY" \
  "S3_SECRET_ACCESS_KEY=$S3_SECRET_KEY" \
  "S3_BUCKET=$S3_BUCKET" \
  "S3_REGION=$S3_REGION" \
  "S3_FILE_URL=https://$S3_BUCKET.$S3_ENDPOINT" \
  "S3_PREFIX=alkemart/" \
  --skip-deploys 2>&1

# Remove the local FILE_DRIVER that overrides railway.toml's s3
echo ""
echo "Removing FILE_DRIVER=local override..."
railway variable delete FILE_DRIVER --service alkemart-api --environment production --yes 2>&1

echo ""
echo "=== S3 Config Set ==="
echo "Backend will use S3 on next deploy."
echo "Run: railway service redeploy --service alkemart-api"
