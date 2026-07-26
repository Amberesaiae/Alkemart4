#!/usr/bin/env bash
set -euo pipefail

# Deploy Alkemart storefront to Vercel.
# Prerequisites: npm install -g vercel && vercel login

echo "=== Alkemart Storefront Deploy to Vercel ==="
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &>/dev/null; then
  echo "Vercel CLI not found. Install it:"
  echo "  npm install -g vercel"
  echo "  vercel login"
  exit 1
fi

# Check if we're in the storefront directory
if [ ! -f "vite.config.ts" ]; then
  echo "Run this script from apps/storefront/"
  exit 1
fi

echo "Step 1: Link to Vercel project (create one if needed)"
vercel link

echo ""
echo "Step 2: Set environment variables"
vercel env add VITE_MEDUSA_BACKEND_URL production <<< "https://alkemart-api-production.up.railway.app"
vercel env add VITE_MERCUR_VENDOR_URL production <<< "https://alkemart-api-production.up.railway.app/seller"
vercel env add VITE_MERCUR_ADMIN_URL production <<< "https://alkemart-api-production.up.railway.app/dashboard"
vercel env add VITE_HOME_DEMO production <<< "0"

echo ""
echo "Step 3: Deploy to production"
vercel --prod

echo ""
echo "=== Deploy Complete ==="
echo "Update Railway CORS if the Vercel URL differs from alkemart-storefront.vercel.app"
