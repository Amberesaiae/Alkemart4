# Launch gate status

**Architecture SoR:** `docs/architecture/workers/` (start with `AGENT-PLAYBOOK.md` + `LOCAL-DEV.md`)  
**Ignore:** `archive/**`

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 1 | Payments | Partial | COD proven; live MoMo/card money matrix still required (`PAYMENTS-LAUNCH-GATE.md`). Concurrency-hardened 2026-09-06: atomic stock reserve, CAS intent transitions, intent-before-charge ordering, hourly expiry cron (`ACID-DATAFLOW.md` § Concurrency hardening) |
| 2 | Medusa quarantine | Docs archived; code dual-path remains | Do not extend Medusa. Storefront may still carry SDK for lab — new work is Workers-only |
| 3 | Hardening | Partial | Headers, rate limit (auth/checkout/hooks/order-lookup), CORS docs. Need WAF + demo password rotation for public |
| 4 | Ops | Partial | Ready probe, migrate helpers (`/admin/migrate/schema` applies product image/created_at patches), Workers runbooks, intent-expiry cron |
| 5 | E2E | API smoke + acid scripts | `bun run smoke` / `smoke:acid` / `smoke:local`. Browser automation deferred |
| 6 | Product gaps | Partial | Returns / address book / wishlist not in Workers SoR. Product images shipped 2026-09-06: `products.image_url` (vendor-pasted URL via vendor dashboard), card fallback art when absent |

## Remaining before public pilot

1. `wrangler deploy` the API (ships the Hyperdrive RYW fix + concurrency hardening).
2. Run the live money matrix (`PAYMENTS-LAUNCH-GATE.md`) — blocked by policy, not code.
3. Rotate demo passwords + enable Cloudflare WAF/rate-limiting rules for public traffic.

## Local for agents

```bash
bun run dev:workers
bun run smoke:local
```
