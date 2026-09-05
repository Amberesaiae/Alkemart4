# Atomic workflow plans — master index

| Field | Value |
|-------|--------|
| **Date** | 2026-07-19 |
| **Purpose** | One plan pack per atomic workflow: audit → gaps → plan → reevaluation → engineering balance |
| **Screens** | `screens/*.png` (live storefront capture) |
| **Related audits** | RBAC · Ghana/Mowafer · PLP_MAP · PRODUCT_CARD_MAP |

## How to use this pack

1. **Audit** — what the screen/API does today (with screenshot).  
2. **Inconsistencies** — doc vs code vs Mowafer vs Ghana.  
3. **Engineering balance** — over-engineered vs under-engineered.  
4. **Plan** — ordered tasks (P0/P1/P2), owner surface (storefront / API / Mercur).  
5. **Reevaluation gate** — pass/fail checklist before marking workflow “in sync”.  
6. **Do not** expand scope into dual-home SPA admin or invent commerce data.

## Workflow catalog

| ID | Workflow | Plan file | Screen |
|----|----------|-----------|--------|
| W01 | Home discovery | [W01-home.md](./W01-home.md) | `screens/01-home.png` |
| W02 | PLP browse + filters | [W02-plp.md](./W02-plp.md) | `02-plp-*.png` |
| W03 | Search | [W03-search.md](./W03-search.md) | `04-search.png` |
| W04 | PDP + multi-seller | [W04-pdp.md](./W04-pdp.md) | `14-pdp.png` |
| W05 | Cart multi-seller | [W05-cart.md](./W05-cart.md) | `05-cart.png` |
| W06 | Checkout Ghana COD | [W06-checkout.md](./W06-checkout.md) | `06-checkout.png` |
| W07 | Auth (login/register) | [W07-auth.md](./W07-auth.md) | `07-signin.png` |
| W08 | Orders (guest + account) | [W08-orders.md](./W08-orders.md) | `08-orders-guest.png` |
| W09 | Account + addresses | [W09-account.md](./W09-account.md) | `13-account.png` |
| W10 | Sellers index + store | [W10-sellers-store.md](./W10-sellers-store.md) | `09-sellers.png` |
| W11 | Sell / partners (ops entry) | [W11-sell-partners.md](./W11-sell-partners.md) | `10-sell.png`, `11-partners.png` |
| W12 | Seller hub lifecycle | [W12-seller-ops.md](./W12-seller-ops.md) | (Mercur `/seller`) |
| W13 | Admin moderation | [W13-admin-ops.md](./W13-admin-ops.md) | (Mercur `/dashboard`) |
| W14 | Search index + sellable | [W14-discovery-index.md](./W14-discovery-index.md) | — |
| W15 | RBAC cross-actor | [W15-rbac-matrix.md](./W15-rbac-matrix.md) | e2e |
| W16 | Seller product isolation | [2026-07-19-seller-product-isolation.md](../2026-07-19-seller-product-isolation.md) | Seller Hub products list |
| W17 | Performance / Neon / catalog | [2026-07-19-performance-practices.md](../2026-07-19-performance-practices.md) | API + DB |

## Global sync rules (all workflows)

| Rule | Under-engineering risk | Over-engineering risk |
|------|------------------------|------------------------|
| **ATC = offer_id** | Silent non-buyable cards | Dual money paths |
| **Three doors** | Ops in SPA | Dual-home CASL |
| **No invent** | Empty UI honesty | Demo seed in prod money |
| **Exclusive seller products** | Shared Mercur catalog leaks lab SKUs into every shop | Over-filter so offers cannot attach to intentional shared masters |
| **No inline CSS** | One-off style={} | Theme framework bloat |
| **Ghana first** | Ignore regions/COD | Egypt loyalty/slots day-1 |
| **Docs = code** | Stale RBAC docs | Spec without ship |

## Dependency graph

```
W01 Home ──► W02 PLP ──► W04 PDP ──► W05 Cart ──► W06 Checkout ──► W08 Orders
                │              │
                └─ W03 Search ─┘
W07 Auth ──► W09 Account ──► W08 (account list)
W10 Store ◄── W12 Seller catalog
W13 Admin ──► W12 approve ──► W01/W02 catalog truth
W14 Index ──► W02/W03 facets + location
W15 RBAC ──► gates all of the above
```

## Program phases (cross-workflow)

| Phase | Theme | Workflows unblocked |
|-------|--------|---------------------|
| **P0** | Honesty + UX blockers | W08 guest lookup ✓, roles sanitize ✓, docs ✓ |
| **P1** | Buyer integrity | **Done 2026-07-19** — W06 bind, W07 cart attach, W08 order policy, status rate-limit, W10 seller catalog |
| **P2** | Catalog truth | **Done 2026-07-19** — catalog `min_price`, peer `offers?product_id=`, seller_city index fields, live e2e |
| **P3** | Ops hardness | W12/W13 strict gates, W15 e2e matrix complete |

## Reevaluation cadence

After each P0/P1/P2 slice:

1. Re-screenshot affected `screens/*`  
2. Tick reevaluation gates in each W-file  
3. Update this index **Sync score** below  

## Sync score (update after reevaluation)

| Workflow | Audit | Plan | P0 done | P1 done | In sync? |
|----------|-------|------|---------|---------|----------|
| W01 Home | ✓ | ✓ | partial | ✓ min_price path | Partial* |
| W02 PLP | ✓ | ✓ | partial | ✓ prices | Partial* |
| W03 Search | ✓ | ✓ | | location facets wired | Partial |
| W04 PDP | ✓ | ✓ | | ✓ peer product_id | Yes* |
| W05 Cart | ✓ | ✓ | | ✓ transfer + live ATC | Yes* |
| W06 Checkout | ✓ | ✓ | | ✓ bind + live COD | Yes* |
| W07 Auth | ✓ | ✓ | | ✓ cart attach | Yes* |
| W08 Orders | ✓ | ✓ | ✓ | ✓ email policy live | Yes* |
| W09 Account | ✓ | ✓ | | | Partial |
| W10 Sellers/Store | ✓ | ✓ | sections | ✓ seller_handle live | Yes* |
| W11 Sell/Partners | ✓ | ✓ | | | Yes* |
| W12 Seller ops | ✓ | ✓ | | live upload+offer | Lab |
| W13 Admin ops | ✓ | ✓ | | live publish | Lab |
| W14 Index | ✓ | ✓ | types | city/province fields | Partial |
| W15 RBAC | ✓ | ✓ | partial | buyer P1 + live | Partial |

\*P1+P2 code + live e2e (`scripts/live-e2e-human-flows.sh`, `LIVE-E2E-2026-07-19.md`). Re-screenshot optional.

\*Deep-link only by design.

## Source audits (do not duplicate full text)

- `../2026-07-19-rbac-workflow-production-audit.md`
- `../2026-07-19-ghana-mowafer-marketplace-system-audit-and-plan.md`
- `../../apps/storefront/docs/PLP_MAP.md`
- `../../apps/storefront/docs/PRODUCT_CARD_MAP.md`
- `../2026-07-16-ops-rbac-surfaces.md`
