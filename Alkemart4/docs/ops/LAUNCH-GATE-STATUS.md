# Launch gate status

**Architecture SoR:** `docs/architecture/workers/` (start with `AGENT-PLAYBOOK.md` + `LOCAL-DEV.md`)  
**Ignore:** `archive/**`

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 1 | Payments | Partial | COD proven; live MoMo/card money matrix still required (`PAYMENTS-LAUNCH-GATE.md`). Hardened: atomic reserve, CAS intents, intent-before-Paystack, **reserve-before-charge/initialize**, expiry job (`ACID-DATAFLOW.md`) |
| 2 | Medusa quarantine | Quarantined | Docs archived. Storefront `getMedusaClient` fails closed unless `VITE_ALLOW_MEDUSA_LAB=1` + Medusa URL; production Vite aliases SDK to `medusa-stub`. Do not extend Medusa |
| 3 | Hardening | Partial | Headers, rate limit (auth/checkout/hooks/order-lookup), CORS. WAF checklist: `docs/ops/cloudflare-waf-checklist.md`. Demo rotate: `POST /admin/migrate/rotate-demo-passwords` (see `DEMO-ACCOUNTS.md`) — run before public |
| 4 | Ops | Partial | Ready probe, migrate helpers, intent expiry via cron **or** `POST /admin/migrate/expire-payment-intents` (Free-tier workaround) |
| 5 | E2E | API smoke + acid scripts | `bun run smoke` / `smoke:acid` / `smoke:local`. Browser automation deferred |
| 6 | Product gaps | Partial | Returns / address book / wishlist not in Workers SoR. Product images shipped 2026-09-06: `products.image_url` (vendor-pasted URL), card fallback art when absent |

## Remaining before public pilot

1. ~~`wrangler deploy` the API~~ Done 2026-09-06 (+ follow-up reserve-before-charge / quarantine / expiry admin trigger — redeploy API + storefront when shipping this wave).
2. Run the live money matrix (`PAYMENTS-LAUNCH-GATE.md`) — blocked by policy, not code.
3. Rotate demo passwords (`DEMO-ACCOUNTS.md`) + apply `docs/ops/cloudflare-waf-checklist.md`.
4. Payment-intent expiry: prefer Workers cron (`wrangler.toml [triggers]`). On Free (API 10072 when 5 slots used): schedule hourly `POST /admin/migrate/expire-payment-intents` with admin JWT, or free a cron slot / upgrade to Paid and re-deploy.

## Local for agents

```bash
bun run dev:workers
bun run smoke:local
```
