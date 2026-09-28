# Handoff — audit and fixes, 2026-09-27 (Claude Code → Codex)

Read this first, then `HANDOFF.md` for the wider picture. Everything below is
**uncommitted** in the working tree on `main` (with the owner's earlier
uncommitted storefront-v2 visual work mixed in). Nothing here is deployed.

**Codex security follow-up:** see `docs/ops/SECURITY-HARDENING.md` for newer local
changes and unresolved production gates. This audit's original security findings
below describe the pre-fix state, not completed rotation/MFA/WAF. AGENTS.md's
stay-on-main rule wins over the branch suggestion below. No production changes
or deletion of v1 have been performed. Stock restore now requires `--apply`.

## State of the checks (all green at hand-off)

API 360 tests · domain 180 · storefront-v2 122 · typecheck + eslint on the
three v2 apps · `check:migrations` · `check:api-client`. Walked in the
in-memory sandbox (`bun apps/api/scripts/sandbox.ts`): a brand-new seller
signs up → is approved → uploads a photo → lists → sells (card, handover
code) → is paid out; returns, holds, refunds, reports, suspend/unsuspend.

## What changed (and why)

**Sellers**
- Password reset works: `/forgot-password` and `/reset-password` in
  vendor-v2 (the email linked to a page that didn't exist). A cut-off reset
  link now says "link expired" instead of "password too short" (buyers too).
- Listings are trusted by default: review mode `trust` (new default,
  `packages/domain/src/listing-review.ts`). Rule-clean, unflagged listings
  go live on publish; flagged ones (banned words, price outlier, duplicate)
  or ones the AI doubts wait in admin → Listings. Editing a live listing no
  longer silently takes it off sale — a clean edit is re-approved at once
  (`autoReview`/`reviewIfSentBack` in `apps/api/src/routes/vendor/products.ts`).
  Seller buttons say "Publish" and show the real outcome.
- Photos a seller removes (gallery, cover, option photo, deleted listing) and
  replaced logos/banners are deleted from R2 — only their own uploads, never
  one still used (`apps/api/src/lib/media-cleanup.ts`).
- Refunded orders show "Refunded to buyer" in Money (was "Next payout").
- Price-check nag no longer fires for new listings or promises hiding.

**Buyers**
- "I got my order" appears only once the order is sent (pickup: any time)
  and asks "Is everything in your hands?" first; the API refuses early
  confirms (it pays the seller).
- Product pages 404 for drafts / in-review / rejected listings and for
  suspended shops (unless another open shop sells the same item).
- Verified-purchase reviews publish at once; ones with a phone, email, link
  or off-platform ask wait for admin (`reviewNeedsCheck` in domain).

**Admin**
- Overview, Business and Sellers show the same sales/orders (one source:
  `platformSummary` in `apps/api/src/lib/business.ts`; old
  `platformOrderStats` removed).
- Overview "Needs attention" leads with the daily pilot jobs (returns to
  decide, refunds to check, sellers ready to pay, reported chats).
- Nav: Campaigns / Guides / Search & traffic moved to a "Growth" group.
- Buyer reviews: "Waiting" and "Live" tabs (hide a published review).

**Images**
- Cards/lists use the 400px `.thumb.webp` with fallback to the full photo
  (`@alkemart/shared/media`). HEIC gets "Use a JPG, PNG or WebP photo."
- `MEDIA_PUBLIC_URL` (optional Worker var): new uploads served from an R2
  custom domain (CDN, no Worker per view). `/media/*` now edge-cached.
- `public/screenshots/home-mobile.png` (manifest install screenshot) added.

**Plumbing**
- Sandbox mirrors seller writes into the catalogue snapshot (new shops can
  sell in the sandbox); in-memory repo stamps `createdAt` like Postgres.
- `bun run dev`, `dev:storefront|vendor|admin`, `test:storefront` (CI) now
  target the v2 apps (they ran the retired v1 apps).
- `.gitignore`: database backups (`*.dump`, `alkemart-backup-*`) and
  `.stock-backup-*.json`.
- Docs updated: LIFECYCLE-ADMIN/BUYER/VENDOR, PILOT-PLAN, LAUNCH-GATE-STATUS,
  CDN-APPROACH, CODEX-ASSETS.

## Do next, in order

1. **Commit on a branch** (not `main`), in reviewable commits. Keep the
   owner's storefront-v2 visual work as its own commit. Don't commit
   `alkemart-backup-2026-09-27.*` (now ignored).
2. **Security before inviting shops** (owner-approved direction, details in
   "Security" below): rotate every demo password and remove them from
   `docs/DEMO-ACCOUNTS.md`; apply Cloudflare rate-limiting/WAF rules; decide
   admin MFA (WorkOS or Cloudflare Access).
3. **Stock out the demo/test shops** (owner request: mock products stay
   visible, can't be bought, until real shop owners list):
   `DATABASE_URL=<session-pooler url> bun scripts/pilot-stock-out-demo.ts`
   (dry run: lists every shop) → owner confirms which handles are test shops →
   `--apply --shops=a,b` (writes a restore backup first; `--restore=<file>`
   undoes it). Then rotate those shops' passwords so they can't restock.
4. **Deploy** API + three Pages apps (`bun run deploy:api`,
   `bun run deploy:pages`). After deploy: check admin → Listings shows the
   intended review mode (a mode already saved in `platform_settings` wins
   over the new `trust` default). Optionally set up the media domain
   (LAUNCH-GATE-STATUS #5).
5. **Delete v1** — `V1-REMOVAL.md` (owner approved; separate PR).
6. Smaller gaps found, not done: sellers can't reply to reviews in vendor-v2
   (API `POST /vendor/reviews/:id/respond` exists, no UI); admin Orders never
   opens `GET /admin/orders/:id`; uploads abandoned before a listing is saved
   are never swept from R2; live MoMo/card money rehearsal still owed
   (`PAYMENTS-LAUNCH-GATE.md`).

## Security assessment (owner asked "are we up to par?")

Good: PBKDF2 password hashing with per-user salt; Paystack webhooks verified
by HMAC-SHA512; exact-origin CORS; Bearer tokens (no cookies, so no CSRF);
security headers; magic-byte-checked uploads with a strict key allowlist;
Drizzle (parameterised SQL); RLS/tenant-isolation tests; handover-code
attempt limits; admin actions audit-logged; money moves only after
Paystack confirms.

Gaps, most serious first:
1. **Demo credentials for production are in the repo**, including an admin
   (`docs/DEMO-ACCOUNTS.md`, "rotate before launch"). Admin can pay out money
   and refund. Rotate now (`POST /admin/migrate/rotate-demo-passwords`), strip
   the passwords from the doc, and check git history exposure if the repo is
   ever shared.
2. **Admin has password-only sign-in**, 7-day sessions in `localStorage`.
   Recommend putting the admin console behind MFA: **WorkOS AuthKit with MFA
   required, for admin only** (buyers/sellers keep the current login for the
   pilot), or **Cloudflare Access** in front of the admin Pages app and
   `/admin/*` (free for small teams, no code). Also shorten admin sessions.
3. **Rate limiting is per Worker instance, in memory**
   (`apps/api/src/middleware/security.ts` says so itself) — brute force can
   spread across instances. Apply `docs/ops/cloudflare-waf-checklist.md`
   (Cloudflare rate-limiting rules on `/admin/auth`, `/vendor/auth`,
   `/store/auth`, checkout). No account lockout exists.
4. PBKDF2 at 100k iterations; OWASP's current guidance for PBKDF2-SHA256 is
   600k. Raise it and re-hash on next successful login (check Worker CPU).
5. Buyer/seller sign-up has no bot protection. WorkOS Radar (or Cloudflare
   Turnstile, free) on register/login if abuse appears.

**On WorkOS:** worth it for the admin console (MFA/SSO, audit) — a contained
change. Moving buyers and sellers to AuthKit is a larger migration; not
recommended before the pilot. The WorkOS MCP server is configured in the
owner's Claude Code (user scope); Codex needs its own setup (see
https://workos.com/docs/mcp).
