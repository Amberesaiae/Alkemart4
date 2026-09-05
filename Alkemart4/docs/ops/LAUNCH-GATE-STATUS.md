# Launch gate status (succession)

Updated after Workers canonical docs + Medusa planning archive.

**Architecture SoR:** `docs/architecture/workers/`  
**Medusa planning:** `archive/docs-medusa-era/` (do not implement)

| # | Gate | Status | Evidence |
|---|------|--------|----------|
| 1 | Payments harden | **Partial** | Status poll verifies Paystack; webhook confirms on success; fail releases stock. Live MoMo/card money matrix still required. See `PAYMENTS-LAUNCH-GATE.md`. |
| 2 | Medusa quarantine | **Docs archived; code dual-path remains** | Active docs no longer claim Medusa write path. Storefront still has SDK dual-path for lab; `apps/backend` Medusa package still in tree. Pages builds stub SDK when Workers URL set. |
| 3 | Hardening | **Partial** | Security headers + rate limit. CORS documented (`cors-and-origins.md`). Need WAF + demo password rotation before public. |
| 4 | Ops | **Partial** | `/health/ready`, migrate one-shots, Workers runbook/rollback/monitoring rewritten. |
| 5 | E2E smoke | **API smoke + ACID script done** | `scripts/e2e-workers-smoke.sh`, `scripts/e2e-workers-acid.sh`. Browser Playwright deferred. |
| 6 | Product gaps | **Partial** | Help FAQ. Returns / address book / wishlist not in Workers SoR. |

## Still before public launch

1. Paystack live money matrix  
2. Rotate demo passwords  
3. Cloudflare WAF / Rate Limiting  
4. Custom domains + `ALLOWED_ORIGINS`  
5. Optional later: Playwright Workers nav matrix (deferred)  
6. Remove storefront Medusa dual-path; archive Medusa API package  
7. Returns / address book only if launch scope requires them  
