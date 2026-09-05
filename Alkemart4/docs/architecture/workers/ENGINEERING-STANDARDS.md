# Engineering standards — Workers era

Full doctrine: [`AGNOSTIC-APPROACH.md`](./AGNOSTIC-APPROACH.md).

## Backend first principles

1. **Owned kernel** — marketplace rules live in `packages/domain` + `apps/api`, not in Medusa/Mercur.  
2. **Single writer** — Workers API is the only commerce write path.  
3. **Pesewas integers** — no float money in ledger or quotes.  
4. **Offer-bound cart** — ATC uses `offerId`; Product ≠ Offer.  
5. **Transactions for stock/money** — reserve / release / confirm / payout in DB txs.  
6. **Idempotent confirms** — webhooks and polls must not double-create OrderGroups.  
7. **Charge-before-commit for async MoMo** — pending + reserve, then webhook/poll.  
8. **Seller scope** — vendor routes never mutate another seller’s rows.  
9. **Fail closed** — missing Paystack / Hyperdrive / auth → explicit 4xx/5xx, not silent dual-path.  
10. **Migrate honestly** — prefer Drizzle; admin one-shots are ops escape hatches, documented.  
11. **Docs = code** — if behavior changes, update `docs/architecture/workers/` in the same change.  
12. **Ghana locale** — use `@alkemart/shared/ghana`; do not fork constants into SPAs.

## Frontend production practices

1. **Workers URL required** for production builds (`VITE_ALKEMART_API_URL`).  
2. **Gold brand** `#FEBF31` — no sludge/OSS shell swaps.  
3. **TanStack Query** for server state; no inventing commerce rows in the client.  
4. **Empty / error honesty** — features not on Workers show unavailable, not fake success.  
5. **Nav = capability** — hide routes the API cannot serve.  
6. **Accessible forms** — labels, errors, focus; language control where present.  
7. **Verify in browser** — UI changes need click-path verification (manual against Pages using `NAV-MATRIX.md`; automation optional later), not screenshot-only.

## Definition of done (feature)

- [ ] API route + domain rule + DB effect documented in the matching lifecycle doc  
- [ ] Unit/integration test for money/stock transitions  
- [ ] ACID script scenario or explicit deferral note  
- [ ] UI nav/click covered if user-visible  
- [ ] No new Medusa / Mercur imports  
