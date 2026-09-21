# Blueprint Phase 7 — Lifecycle and marketplace growth

**Roadmap ref:** roadmap Phase 7. **Requires:** event dictionary (Phase 0),
notification infra (exists), preference center (this phase).
**Lifecycle owner:** buyer + vendor + admin.

## Goal

Growth messages are permission-aware, attributable, frequency-controlled, and
measured through delivered orders, returns, complaints, and seller outcomes.

## Slices

### 7A. Preference center + classification

- DB: `notification_preferences` (user/seller, channel, category
  transactional|promotional|operational, opt-in/out, frequency cap).
- API: preference CRUD (store + vendor); classification enforced at send time —
  promotional send without opt-in is rejected and logged.
- UI: account preference center (storefront `routes/account.tsx` section);
  vendor alert preferences.
- Tests: promo-without-consent rejected test; transactional-vs-promo
  separation test.

### 7B. Buyer journeys (conservative frequency)

- Saved product/search + back-in-stock / price-change events; cart reminder
  after measured intent; delivery/pickup progress; verified-purchase review
  request post-delivery; followed-shop collection updates (opt-in, later).
- Each journey: event trigger → eligibility → template → channel fallback →
  delivery audit → attribution to delivered order.
- Analytics: journey events per Doc 10 + `order_delivered`, `refund`,
  `return_requested` reconciliation.

### 7C. Seller journeys

- Low-stock, stale-price, order SLA, payout, policy-action alerts leading
  directly to the relevant task (deep links).
- Dashboard recommendation-acted-on event closes the loop to Phase 4 growth tab.

### 7D. Campaign holdouts + experiment registry

- DB: `experiments` (randomization unit, exposure, primary metric, guardrails,
  duration, audience, stopping rule, status).
- API/admin: registry CRUD + holdout assignment; reversible ranking/layout
  tests only — never on payment correctness, legal disclosure, trust meaning,
  accessibility, safety.
- Reporting: incrementality + guardrail dashboard (cancellation/return,
  complaints, seller economics alongside conversion).

## Migration / rollback

- Journeys ship one at a time behind per-journey flags; kill switch per
  journey + global promo-pause; rollback = flags off, transactional only.

## Acceptance

 Each live journey: permission checked, frequency capped, attributed to
 delivered (not just initiated) commerce, with holdout reading where claimed.

## Unconstructive flags

- Promotions before preference infra; engagement mechanics unrelated to
  shopping decisions; permanent-discount loops; fake scarcity/countdowns;
  optimizing clicks while ignoring returns/complaints/seller economics.
