# Mode B — COD lab demo runbook

| Field | Value |
|---|---|
| **Date** | 2026-07-16 |
| **Mode** | B (honest lab freeze) |
| **Supported claim** | Cash-on-delivery buy path only |

---

## One sentence

> **This is a lab marketplace: browse a thin catalog, pay with cash on delivery, see a lab order reference — not production MoMo or formal receipts.**

---

## Demo path (browser)

1. Open SPA `http://localhost:5175` — lab banner / COD copy on home.
2. Browse → open a product with an **offer** (e.g. Golden Palm Oil).
3. Add to cart → **Continue to checkout**.
4. **Sign in** (or register) so the cart can transfer and appear under **Your orders**.
5. Enter delivery address (Tema etc.) → leave payment on **Cash on delivery**.
6. **Place COD order** → land on order page with **Lab · …** or **#N** if `display_id` exists.
7. **Your orders** lists the same lab reference.

### Runtime

| Process | Port |
|---------|------|
| Mercur API | `:9000` |
| SPA | `:5175` |
| Seller / admin | `:9000/seller`, `:9000/dashboard` |

---

## Explicit non-claims

- MoMo product-ready (hidden unless `VITE_FEATURE_MOMO_LAB=true`)
- Formal receipt numbers for every order
- Multi-vendor split carts
- Settlements / cancel-refund spine
- In-app support chat

---

## Curl smoke (optional)

```bash
# After env + PK/region from SPA .env
# cart + offer + address + shipping + ghana-checkout cod → order_id
```

See prior e2e docs for full curl sequence. Browser path above is the Mode B definition of demo.

---

## When to leave Mode B

Only with an approved **Mode A commercial spine** (durable payment states, order contract, single worktree, browser DoD including paid MoMo if claimed).
