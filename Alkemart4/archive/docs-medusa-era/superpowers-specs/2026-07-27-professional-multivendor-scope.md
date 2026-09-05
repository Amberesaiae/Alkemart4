# Professional Multivendor Marketplace — Scope

**Date:** 2026-07-27
**Status:** Proposed
**Context:** 150 production-readiness fixes applied (18 BLOCKER, 38 HIGH, 51 MEDIUM, 43 LOW). All packages build clean. What remains to reach "professional multivendor marketplace"?

---

## Layer 1: E2E Test Suite (Critical)

**Current state:** 3 Playwright smoke tests + 14 backend unit tests + 2 storefront unit tests. No full-flow E2E.

**Goal:** Automated E2E covering every critical business path, runnable locally and in CI.

### Flows to cover

| Flow | Steps | Priority |
|------|-------|----------|
| Buyer browse → PDP → cart → checkout (COD) | Browse catalog, view product, add to cart, complete COD order | P0 |
| Buyer checkout (MoMo) | Same but via mobile money | P0 |
| Buyer checkout (Paystack card) | Same but via Paystack | P0 |
| Seller registration → onboarding → first product | Create account, complete onboarding, upload product with image | P0 |
| Admin moderation → product goes live | Approve product → confirm it appears in storefront | P0 |
| Order fulfillment → delivery | Complete order → fulfill → mark delivered | P0 |
| Refund flow | Admin initiates refund → buyer sees refund | P0 |
| Seller edits product → re-moderation | Change product → re-moderate → live again | P1 |
| Multi-seller isolation | Seller A cannot see/change Seller B's products | P1 |
| Admin RBAC | Admin can suspend seller → seller's products hidden | P1 |
| Payment failure handling | Expired card → failed payment → retry | P1 |
| Internationalization | Switch language → UI updates | P2 |
| Dark mode | Toggle → all surfaces render correctly | P2 |
| Responsive layout | Mobile viewport → key flows work | P2 |

### Implementation

```typescript
// e2e/tests/checkout.spec.ts — example structure
test("buyer completes COD purchase", async ({ page, request }) => {
  // 1. Browse catalog
  // 2. View product detail
  // 3. Add to cart
  // 4. Enter shipping address
  // 5. Select COD payment
  // 6. Complete order
  // 7. Verify order appears in order history
})
```

**Tooling:** Playwright (already configured), `@playwright/test` fixtures for auth state, test accounts seeded once.

**Seed data:** Create a `test/seed.ts` script (or run once via Playwright global setup) that creates:
- 1 admin account (known credentials)
- 2 seller accounts with approved products
- 1 buyer account with saved address

**Effort:** ~40 tests × ~30 min each = ~20h first pass. Then CI integration (~4h).

---

## Layer 2: CI/CD Pipeline (Critical)

**Current state:** `ci.yml` exists but only builds backend. No test runner.

**Goal:** Every PR runs: lint → typecheck → unit tests → integration tests → E2E tests → build.

### Required

1. **Expand `ci.yml`** — add jobs for each test layer, run in parallel where possible
2. **E2E in CI** — spin up backend + storefront + both SPAs, run Playwright against them. Use Neon ephemeral DB or testcontainers.
3. **Deploy gates** — E2E must pass before Railway/Vercel deploy
4. **Slack/email notifications** — on pipeline failure

**Effort:** ~8h

---

## Layer 3: Monitoring & Observability (High)

**Current state:** `/health` endpoint exists. Sentry DSN accepted in env schema but not wired for error reporting. No uptime monitoring.

### Required

1. **Sentry integration (backend)** — install `@sentry/node`, wire into Medusa error handler
2. **Sentry integration (storefront)** — already has `@sentry/react`, just needs DSN config
3. **Structured logging** — replace `console.log/warn/error` with a logger (pino or Medusa's built-in logger) across all workflows/custom code
4. **Uptime monitoring** — BetterUptime or similar pinging `/health` every 60s
5. **Alert on Paystack failures** — if verifyPayment fails 3× in 5 min, page engineer
6. **Business metrics dashboard** — daily orders, revenue, new sellers, conversion rate (can start with a simple cron that writes to a table)

**Effort:** ~12h

---

## Layer 4: Load & Performance Testing (High)

**Current state:** Never load-tested. Unknown how the system behaves under 50/200/1000 concurrent users.

### Required

1. **k6 or Artillery script** for:
   - Catalog browsing (read-heavy, 80% of traffic)
   - Cart operations (write-heavy, 15%)
   - Checkout completion (transactional, 5%)
2. **Identify bottlenecks** — DB connection pool, Paystack rate limits, Redis throughput
3. **Set performance budgets** — PDP < 1s, checkout < 3s, catalog search < 500ms
4. **MeiliSearch index refresh timing** — how often can it reindex without degrading queries

**Effort:** ~16h

---

## Layer 5: Security Hardening (High)

**Current state:** Security headers via middleware, JWT in httpOnly cookies. But several gaps remain.

### Required

1. **Rate limiting on auth endpoints** — prevent brute force login (use Redis-based limiter)
2. **CSRF protection** — especially for POST/PUT endpoints
3. **Input sanitization everywhere** — product descriptions, seller names, addresses (XSS prevention)
4. **File upload validation** — verify MIME type server-side, not just client; scan for malware
5. **API audit log** — log all admin/seller mutations (who changed what, when)
6. **IP allowlisting for webhooks** — verify Paystack webhooks come from Paystack IPs
7. **Session timeout & rotation** — expire sessions after 24h inactive, rotate on privilege escalation

**Effort:** ~20h

---

## Layer 6: Disaster Recovery & Data Integrity (Medium)

**Current state:** No backup strategy, no rollback runbook, no point-in-time recovery.

### Required

1. **Automated DB backups** — Neon has PITR, but ensure backups are configured and tested
2. **Restore runbook** — step-by-step: "How to restore from backup in < 1 hour"
3. **Payment idempotency at DB level** — ensure duplicate webhooks can't double-charge (current in-memory set is lost on restart → Redis-based dedup)
4. **Transaction log for financial ops** — every payment/refund logged to an immutable audit table
5. **Deployment rollback script** — `railway rollback` plus any manual DB rollback steps
6. **Data retention & GDPR** — delete buyer data on request, anonymize after 3 years

**Effort:** ~16h

---

## Layer 7: Seller & Buyer Experience Gaps (Medium)

**Current state:** Core flows work, but UX is basic.

### Required

1. **Order tracking for buyers** — status badge + timeline (ordered → confirmed → shipped → delivered)
2. **Seller analytics dashboard** — sales by day/week/month, top products, conversion
3. **Product image gallery** — multi-image upload, reorder, zoom on PDP
4. **Search with filters** — MeiliSearch is wired but front-end filtering (category, price range, rating) is minimal
5. **Wishlist / save for later**
6. **Seller notification center** — in-app + email: new order, low stock, product approved/rejected
7. **Buyer account** — order history, saved addresses, payment methods

**Effort:** ~40h (largest layer, many independent features)

---

## Layer 8: Documentation & Runbooks (Medium)

**Current state:** Some ADRs, some specs. No operator runbook.

### Required

1. **Operator runbook** (`docs/ops/`) — how to:
   - Deploy a new version
   - Rollback a bad deploy
   - Investigate a payment failure
   - Restore from backup
   - Add a new seller
   - Handle a security incident
2. **Architecture diagram** — updated with current flow (not the legacy diagrams)
3. **API reference** — for anyone integrating with the marketplace

**Effort:** ~12h

---

## Estimate Summary

| Layer | Effort | Impact | Depends On |
|-------|--------|--------|------------|
| 1. E2E Tests | 24h | Critical | — |
| 2. CI/CD Pipeline | 8h | Critical | Layer 1 |
| 3. Monitoring | 12h | High | — |
| 4. Load Testing | 16h | High | Layer 2 (CI) |
| 5. Security | 20h | High | — |
| 6. DR & Data | 16h | Medium | — |
| 7. UX Gaps | 40h | Medium | — |
| 8. Documentation | 12h | Medium | — |
| **Total** | **~148h** | | |

**Phased recommendation:**

- **Phase A (MVP-Pro):** Layers 1+2+3 — E2E tests, CI that runs them, Sentry monitoring. This is the minimum to call it professional. ~44h.
- **Phase B (Trust):** Layers 4+5+6 — load testing, security, disaster recovery. ~52h.
- **Phase C (Delight):** Layers 7+8 — UX polish and docs. ~52h.
