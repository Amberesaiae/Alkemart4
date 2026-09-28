# Launch gate status

**Architecture SoR:** `docs/architecture/workers/` (start with `AGENT-PLAYBOOK.md` + `LOCAL-DEV.md`)  
**Ignore:** `archive/**`

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 1 | Payments | Partial | COD proven; live MoMo/card money matrix still required (`PAYMENTS-LAUNCH-GATE.md`). Hardened: atomic reserve, CAS intents, intent-before-Paystack, **reserve-before-charge/initialize**, expiry job (`ACID-DATAFLOW.md`) |
| 2 | Medusa quarantine | Quarantined | Docs archived. Storefront `getMedusaClient` fails closed unless `VITE_ALLOW_MEDUSA_LAB=1` + Medusa URL; production Vite aliases SDK to `medusa-stub`. Do not extend Medusa |
| 3 | Hardening | Partial | Headers, rate limit (auth/checkout/hooks/order-lookup), CORS. WAF checklist: `docs/ops/cloudflare-waf-checklist.md`. Demo rotate: `POST /admin/migrate/rotate-demo-passwords` (see `DEMO-ACCOUNTS.md`) — run before public |
| 4 | Ops | Partial | Ready probe, migrate helpers, intent expiry via Queues (delayed per-intent messages; no cron configured) **or** `POST /admin/migrate/expire-payment-intents` as the backstop |
| 5 | E2E | API smoke + acid scripts | `bun run smoke` / `smoke:acid` / `smoke:local`. Browser automation deferred |
| 6 | Product gaps | Partial | Returns / address book / wishlist not in Workers SoR. Product photos: vendors upload (phone-side shrink to ≤1600px JPEG, 5 MB cap, magic-byte check) to R2 via `POST /vendor/uploads`; with the Images binding each upload also gets a ≤1600px WebP and a 400px `.thumb.webp`, which cards and lists use (`@alkemart/shared/media`). Served from `/media/*` with immutable caching |

## Remaining before public pilot

2026-09-27 security follow-up is **implemented locally, not activated in production**:
short admin sessions, admin/seller revocation, global attempt limits, Turnstile
signup wiring, redacted demo document and safer stock tooling. Credential rotation,
MFA provider choice/setup, WAF, Turnstile keys, deployment and exact demo-shop
handles remain gates. Higher password work factor is staged but blocked by the
production runtime cap. See [`SECURITY-HARDENING.md`](./SECURITY-HARDENING.md).

1. ~~`wrangler deploy` the API~~ Done 2026-09-06 (+ follow-up reserve-before-charge / quarantine / expiry admin trigger — redeploy API + storefront when shipping this wave).
2. Run the live money matrix (`PAYMENTS-LAUNCH-GATE.md`) — blocked by policy, not code.
3. Rotate demo passwords (`DEMO-ACCOUNTS.md`) + apply `docs/ops/cloudflare-waf-checklist.md`.
4. Payment-intent expiry runs on Cloudflare Queues (delayed per-intent messages, see `wrangler.toml`); confirm the four queues exist in the account. `POST /admin/migrate/expire-payment-intents` stays as the manual backstop.
5. **Photos off the Worker (recommended before traffic):** R2 → `alkemart-media`
   → Settings → Custom Domains → add e.g. `media.<your domain>`, then set the
   Worker var `MEDIA_PUBLIC_URL=https://media.<your domain>` and redeploy. New
   uploads are then served by Cloudflare's CDN straight from R2 (no Worker
   request per image view). Existing `/media/…` URLs keep working, now with
   edge caching. Removed product photos and replaced logos/banners are
   deleted from R2 automatically.

## Local for agents

```bash
bun run dev:workers
bun run smoke:local
```
