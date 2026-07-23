---
name: Production Stack Decisions
description: Authoritative deployment stack — Neon + Railway + Vercel + Tigris/B2. Notification pipeline — Africa's Talking SMS/WA + Meta Cloud WhatsApp.
---

## Deployment stack (confirmed, not Fly.io)
- **Backend**: Railway (`apps/backend/railway.toml`) — primary. fly.toml is archived fallback only.
- **Database**: Neon PostgreSQL — pooled URL at runtime, unpooled for migrations only.
- **Cache/events**: Railway Redis — `rediss://` TLS URL.
- **Search**: Railway Meilisearch — use internal Railway hostname for API→Meili traffic.
- **Storage**: Tigris (Railway-native, S3-compatible) or Backblaze B2. R2 is in .env.template but user said ignore Cloudflare.
- **Storefront**: Vercel — `apps/storefront/vercel.json` present with full CSP + SPA rewrites.

**Why:** Railway is the confirmed primary host (per DEPLOYMENT.md ADRs 2026-07-19, 2026-07-20).

## fly.toml fixes applied
- `NODE_ENV` changed `development` → `production`
- `FILE_DRIVER` changed `local` → `s3`
- Region changed `lhr` → `jnb` (Johannesburg, ~40ms to Ghana vs ~120ms from London)

## Notification pipeline
- **Email**: Resend API (`RESEND_API_KEY`) — already wired via `src/lib/email.ts`
- **SMS**: Africa's Talking — `src/lib/sms.ts` (pattern mirrors email.ts; log-only fallback)
  - AT has direct Ghana telco interconnects (MTN, Telecel, AirtelTigo)
  - Numbers normalised to E.164 before AT call; AT requires international format
  - Env vars: `AT_API_KEY`, `AT_USERNAME`, `AT_SENDER_ID` (register "ALKEMART" at AT)
- **WhatsApp**: Meta Cloud API — `src/lib/whatsapp.ts` (template messages only)
  - Env vars: `WA_PHONE_NUMBER_ID`, `WA_ACCESS_TOKEN`
  - Templates must be pre-approved: `alkemart_order_confirmed`, `alkemart_order_shipped`, `alkemart_new_order_vendor`, `alkemart_seller_approved`
- **New subscriber**: `src/subscribers/order-lifecycle-notify.ts` — order.placed/shipped/delivered/canceled

## Storefront PWA
- `vite-plugin-pwa` + `workbox-window` installed in storefront
- Config in `vite.config.ts`: generateSW strategy, NetworkFirst for Railway API, CacheFirst for images
- Offline fallback: `/offline.html` (served when offline)
- Manifest: `public/manifest.webmanifest` (gold #febf31 theme, dark #1a1a1a background)
- **Important**: icon files (`public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`) and `screenshots/` must be created before PWA install prompt works

## Pre-existing storefront TS errors (not my changes)
- `@alkemart/shared` import errors in error-boundary.tsx, brand.ts, ghana-locale.ts, utils.ts
- ListingLocationFilter.tsx implicit any params
- These existed before this session — caused by unbuilt monorepo shared package
- Fix: build the `@alkemart/shared` package or path-alias it in tsconfig

## .env.template
- Fully updated with: Neon best practices, Railway Redis/Meili, Tigris + B2 options, AT SMS, Meta WA, Resend email
- All secrets go Railway dashboard — never in railway.toml or committed files
