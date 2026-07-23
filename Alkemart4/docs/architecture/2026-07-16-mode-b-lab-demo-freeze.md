# Mode B — Honest lab demo freeze

| Field | Value |
|---|---|
| **Date** | 2026-07-16 |
| **Status** | **Accepted** — product chose Mode B over “spine lock” |
| **Intent** | Stop the loop of partial adapters claiming production readiness |

---

## Decision

Alkemart is a **lab marketplace demo**, not a production Ghana marketplace.

| Claim | Mode B truth |
|-------|----------------|
| Buy something | **Cash on delivery only** (supported) |
| Mobile Money | **Lab-only** (`VITE_FEATURE_MOMO_LAB=true`); unfinished money spine |
| Order number | Prefer Medusa `display_id`; else **“Lab · XXXXXX”** — not a formal receipt |
| Architecture complete | **No** |
| Dual-home SPA ops | **Off** (Mercur for seller/admin) |

---

## Product rules (do not violate without Mode A spine)

1. **Do not** market MoMo as ready.  
2. **Do not** treat curl 200s as “E2E done.”  
3. **Do not** add Express dual-home ops.  
4. **Do not** invent human order numbers from opaque ids without saying “lab.”  
5. New work must either:  
   - improve the **COD lab story**, or  
   - open **Mode A commercial spine** as a separate, frozen scope.

---

## Supported lab path (definition of demo)

```text
SPA → browse catalog (thin) → offer cart → address → shipping option
   → COD ghana-checkout → order list/detail with lab reference
```

**Out of demo claims:** multi-vendor split, settlements, cancel/refund, support chat, production MoMo, dense catalog, formal receipts.

---

## Flags

| Env | Default | Meaning |
|-----|---------|---------|
| `VITE_FEATURE_MOMO_LAB` | unset / off | Hide MoMo at checkout |
| `VITE_FEATURE_MOMO_LAB=true` | opt-in | Show MoMo labeled “Lab only”; real Paystack when `PAYSTACK_SECRET_KEY` set — **not** simulated success |
| `VITE_OPS_BACKEND` | `off` | No SPA admin/vendor |

---

## Exit Mode B → Mode A

Only after a written commercial spine is approved:

- durable payment intent states  
- order contract (`display_id`, payment method, address, totals)  
- single API worktree  
- browser DoD: register → COD or MoMo paid → Order **#N** → seller sees it  

Until then: **this freeze holds.**
