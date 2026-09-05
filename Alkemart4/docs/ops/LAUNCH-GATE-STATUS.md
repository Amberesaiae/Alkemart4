# Launch gate status (succession)

Updated after Workers gold-path hardening.

| # | Gate | Status | Evidence |
|---|------|--------|----------|
| 1 | Payments harden | **Partial** | Status poll verifies Paystack; webhook only confirms on success events; failures mark intent failed + release stock. Live MoMo/card with real money **not** proven in-session. See `PAYMENTS-LAUNCH-GATE.md`. |
| 2 | Medusa quarantine | **Done for Workers prod builds** | Vite aliases `@medusajs/js-sdk` → stub when `VITE_ALKEMART_API_URL` set; no `vendor-medusa` chunk in dist. Lab dual-path code still exists without Workers URL. |
| 3 | Hardening | **Partial** | Security headers + best-effort rate limit on auth/checkout/hooks. Demo passwords warned in `DEMO-ACCOUNTS.md`. Still need Cloudflare WAF rules + secret rotation for public launch. |
| 4 | Ops | **Partial** | `GET /health/ready` (postgres + paystack checks). `POST /admin/migrate/schema` for idempotent patches. Prefer `packages/db` drizzle migrate when `DATABASE_URL` reachable. |
| 5 | E2E smoke | **Done (API/Pages)** | `scripts/e2e-workers-smoke.sh` → `E2E_SMOKE_OK`. Not browser Playwright yet. |
| 6 | Product gaps | **Partial** | Help FAQ covers returns/support/search. Returns still not implemented. Address stored on checkout. Search is title/`q` substring. |

## Live smoke (verified)

- `/health` + `/health/ready` → ok, paystack ok, postgres ok  
- Security headers present  
- Buyer COD + order detail 200  
- Vendor products = 1 (Tecno Spark)  
- Admin orders list  
- All three Pages → 200  

## Still before public launch

1. Run Paystack live matrix in `PAYMENTS-LAUNCH-GATE.md`  
2. Rotate demo account passwords  
3. Cloudflare Rate Limiting / WAF on Worker  
4. Custom domains + CORS `ALLOWED_ORIGINS`  
5. Browser E2E (Playwright) optional next  
6. Returns / address book if required for launch scope  
