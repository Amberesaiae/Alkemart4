# Seller Lifecycle — Detailed

| Field | Value |
|---|---|
| **Date** | 2026-08-02 |
| **Status** | Living — as-built |
| **Parent** | `2026-08-02-full-system-architecture-and-lifecycles.md` |

---

## 1. Two State Machines

Mercur owns the persisted **status**; Alkemart derives a richer **phase** for UX.

| Mercur `seller.status` | Alkemart phase(s) | Meaning |
|---|---|---|
| `open` | `setup_incomplete` → `active` | registered; phase depends on onboarding + approval |
| `pending_approval` | `pending_approval` | awaiting admin review |
| `suspended` | `suspended` | hidden from catalog, panel restricted |
| `terminated` | `terminated` / `rejected` | terminal |

Fields: `status`, `status_reason`, `approved_at`, `rejected_at`, plus Alkemart's `seller.metadata` keys (below).

## 2. Sanctioned `seller.metadata` keys

| Key | Type | Meaning |
|---|---|---|
| `commission_bps` | int | platform commission in basis points (1000 = 10%); set via `/admin/sellers/[id]/commission` |
| `delivery_fee_ghs` | number? | optional flat vendor delivery fee, set in vendor Settings → Dispatch |

Adding a key ⇒ add it to this table in the same PR.

## 3. Flow

### 3.1 Registration
- Mercur creates `seller` + `member` (the human actor). Auth = emailpass.
- `/alkemart/member/me` (authenticate with `allowUnregistered: true`) tells the SPA whether the JWT holder has a seller yet: `404 + registration hint` when `auth.actor_id` is empty.

### 3.2 Onboarding — `POST /vendor/alkemart/onboarding/ghana-setup`
Handled by `lib/ghana-seller-setup.ts` (`runGhanaSellerSetup`):
- profile (store name, contact), Ghana region (16 canonical, from `@alkemart/shared/ghana/regions`), GhanaPost GPS digital address
- MoMo payout details: phone normalized via `operating-markets.ts` (`normalizePhoneForCountry("gh", …)`), provider (mtn | vodafone | airteltigo), → Paystack **transfer recipient** created; `recipient_code` stored on the payout account
- optional `delivery_fee_ghs`
- Vendor polls `GET /vendor/alkemart/onboarding/status` — readiness derived from profile/address/payout presence.

### 3.3 Readiness gate
`lib/seller-readiness.ts` (+ cache + invalidation subscriber) computes whether the seller's products may be publicly sellable. Readiness ≠ approval: both are required.

### 3.4 Admin review — routes under `/admin/sellers/[id]/`
| Route | Effect | Notes |
|---|---|---|
| `approve` | status → `open`, `approved_at` set | triggers `seller-lifecycle-notify` (SMS/WA to seller) |
| `suspend` | status → `suspended` | products drop from catalog (readiness invalidated + search sync) |
| `unsuspend` | status → `open` | restores |
| `terminate` | status → `terminated` | terminal; confirm modal in admin UI states consequence |
| `commission` | `metadata.commission_bps` | displayed as % in both panels |

Admin list/detail: `GET /admin/sellers`, `GET /admin/sellers/[id]` — admin app routes `sellers.tsx`, `sellers.$id.tsx` with approve/suspend/unsuspend/terminate/commission modals.

## 4. Side Effects Matrix

| Transition | SMS/WA | Search | Caches |
|---|---|---|---|
| approved | seller notified | `search-seller-sync` | readiness + catalog invalidated |
| suspended | seller notified | seller + offers de-indexed | 〃 |
| commission change | — | — | — (applies at payout time) |
| onboarding complete | — | — | readiness recomputed |

## 5. Invariants

1. Seller state transitions happen **only** through the admin routes — no direct DB writes, no vendor self-service status changes.
2. `commission_bps` is the single commission source until Mercur's `Commission` entity is adopted (see payouts doc §5).
3. Suspension must always de-list: any new sellable-affecting surface must consult seller status/readiness, not just product status.
4. Phone/address normalization is backend-owned; the vendor app's helpers (`apps/ghana-vendor/src/lib/ghana.ts`) mirror `normalizePhoneForCountry` and must say so.

## 6. Test Coverage

- `e2e/tests/seller-onboarding.spec.ts` — registration → setup → approval
- `e2e/tests/rbac-multivendor.live.spec.ts`, `multi-seller-isolation.spec.ts` — scope enforcement
- Backend unit: `packages/api/src/lib/__tests__`
