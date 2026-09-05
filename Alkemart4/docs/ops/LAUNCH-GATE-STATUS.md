# Launch gate status

**Architecture SoR:** `docs/architecture/workers/` (start with `AGENT-PLAYBOOK.md` + `LOCAL-DEV.md`)  
**Ignore:** `archive/**`

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 1 | Payments | Partial | COD proven; live MoMo/card money matrix still required (`PAYMENTS-LAUNCH-GATE.md`) |
| 2 | Medusa quarantine | Docs archived; code dual-path remains | Do not extend Medusa. Storefront may still carry SDK for lab — new work is Workers-only |
| 3 | Hardening | Partial | Headers, rate limit, CORS docs. Need WAF + demo password rotation for public |
| 4 | Ops | Partial | Ready probe, migrate helpers, Workers runbooks |
| 5 | E2E | API smoke + acid scripts | `bun run smoke` / `smoke:acid` / `smoke:local`. Browser automation deferred |
| 6 | Product gaps | Partial | Returns / address book / wishlist not in Workers SoR |

## Local for agents

```bash
bun run dev:workers
bun run smoke:local
```
