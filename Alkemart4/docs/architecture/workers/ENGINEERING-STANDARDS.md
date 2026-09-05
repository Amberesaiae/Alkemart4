# Engineering standards — Workers era

## Backend first principles

1. **Single writer** — Workers API is the only commerce write path.  
2. **Pesewas integers** — no float money in ledger or quotes.  
3. **Offer-bound cart** — ATC uses `offerId`; Product ≠ Offer.  
4. **Transactions for stock/money** — reserve / release / confirm / payout in DB txs.  
5. **Idempotent confirms** — webhooks and polls must not double-create OrderGroups.  
6. **Charge-before-commit for async MoMo** — pending + reserve, then webhook/poll.  
7. **Seller scope** — vendor routes never mutate another seller’s rows.  
8. **Fail closed** — missing Paystack / Hyperdrive / auth → explicit 4xx/5xx, not silent dual-path.  
9. **Migrate honestly** — prefer Drizzle; admin one-shots are ops escape hatches, documented.  
10. **Docs = code** — if behavior changes, update `docs/architecture/workers/` in the same change.

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
