# Rule: no hardcodes, no magic

| Field | Value |
|---|---|
| **Date** | 2026-07-16 |
| **Status** | **Binding** for greenfield / Mode A / all new PRs |
| **Related** | Greenfield Mercur+shadcn plan, Mode B freeze, clean-slate ADR |

---

## One line

> **If it is commerce truth, it comes from env or the API. If it is missing, fail loud. Never invent it.**

---

## Hardcode vs magic

| | Hardcode | Magic |
|---|----------|--------|
| **What** | Literal IDs, keys, prices, URLs in source | Silent fallbacks that fake success or invent data |
| **Example** | `offer_01KXN…` in a hook | `return { items: [] }` after 500 so UI looks fine |
| **Example** | `pk_…` committed | `email \|\| "customer@alkemart.local"` on charge |
| **Example** | `reg_01…` in TS | `pk_default` so Medusa “sort of” starts |

---

## Source of truth matrix

| Data | Source | Not from |
|------|--------|----------|
| Backend URL, publishable key | Env | Repo TS |
| Region, sales channel | Env (from Admin/seed **output**) | Guessed defaults |
| Products, offers, prices, stock | Store API | Homepage fallback inventing prices |
| Shipping option ids | Store API (flatten map OK) | Hardcoded `so_…` |
| Customer, roles | Auth + customer / me API | CASL invented server roles in client |
| Paystack keys | Server env | SPA |
| Feature switches | Explicit `VITE_FEATURE_*` / server flags | Implicit “if route exists” |

---

## Fail closed (required)

```text
missing VITE_MEDUSA_PUBLISHABLE_KEY  →  throw at client create (dev + prod)
missing cart / offer                 →  error to user, no fake line item
Paystack decline                     →  4xx with message, no “order placed”
API 404/500                          →  error UI / toast, not empty success
feature not built                    →  hidden or “not available”, not Express stub success
```

---

## Allowed exceptions

1. **Design tokens** (colors, type) — not commerce.  
2. **Static legal/marketing copy** — not prices/stock.  
3. **Seed scripts** — local bootstrap only; IDs not imported by SPA.  
4. **Unit tests** — fixtures allowed if isolated from production code paths.  
5. **Pure converters** — pesewas math, phone normalize, enum maps with **input from caller**.

Dev-only `http://localhost:9000` backend URL is allowed **only** when:

- not production build, and  
- documented, and  
- region/key/SC still **required** (no inventing those).

---

## Existing debt (do not extend)

Known debt that violates this rule must **not** grow:

- Smoke curls with pasted `offer_01…` in docs (docs OK; **not** app code).  
- Paystack provider fallback email.  
- Seed fixed passwords (local only).  
- Mode B static homepage **copy** (OK) vs inventing product prices (forbidden — rails must use API).

New PRs that add hardcodes for “demo speed” will be rejected.

---

## Checklist for every PR

- [ ] No new entity IDs or secrets in `.ts`/`.tsx`  
- [ ] No commerce `|| default` that invents money/catalog  
- [ ] New env vars in `.env.template` with empty placeholders  
- [ ] Errors surface to the user or logs; no silent empty success  
- [ ] Seed/bootstrap documented if it creates IDs for `.env`

---

## Relationship to Mode B

Mode B is an **honesty freeze** on product claims (COD lab).  
This rule is an **engineering freeze** on how we code.

You can have lab UI copy (“Lab demo”) without hardcoding offer IDs.  
You cannot “make demo work” by baking Neon IDs into the SPA.
