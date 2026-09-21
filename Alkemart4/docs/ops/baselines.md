# Commerce baselines (Phase 0D)

**Status:** snapshot template — fill dated values before Phase 1 starts.
**Sources:** PostHog export · `./scripts/e2e-workers-smoke.sh` ·
`./scripts/e2e-workers-acid.sh` · Search Console · admin stats endpoints.

| Metric | Value | Date | Source |
|---|---|---|---|
| Search → qualified PDP rate | _tbd_ | | |
| PDP → offer-select / add-to-cart rate | _tbd_ | | |
| Cart → checkout rate | _tbd_ | | |
| Checkout → paid / COD-confirmed rate | _tbd_ | | |
| Order acceptance rate | _tbd_ | | |
| Delivered-order rate | _tbd_ | | |
| Cancellation / return / refund / dispute / failed-delivery rates | _tbd_ | | |
| Repeat buyer rate | _tbd_ | | |
| Retained seller rate | _tbd_ | | |
| Active products with fresh eligible offers | _tbd_ | | |
| Exact-comparison coverage + match accuracy | _tbd_ | | |
| Search zero-result + low-result rates | _tbd_ | | |
| Search refinement rate | _tbd_ | | |
| Filter adoption / removal | _tbd_ | | |
| Time to first relevant product click | _tbd_ | | |
| Seller: time to first offer / first order | _tbd_ | | |
| Payout reliability | _tbd_ | | |
| LCP / INP / CLS per surface (home, PLP, PDP, cart, checkout) | _tbd_ | | |
| Indexed pages / crawl errors | _tbd_ | | |

Rules: initiated-checkout metrics alone never count as improvement; delivered
orders are the north star. Re-snapshot at every phase exit gate.
