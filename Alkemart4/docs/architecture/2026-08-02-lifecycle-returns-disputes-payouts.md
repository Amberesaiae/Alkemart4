# Returns, Disputes & Payouts Lifecycle — Detailed

| Field | Value |
|---|---|
| **Date** | 2026-08-02 |
| **Status** | Living — as-built |
| **Parent** | `2026-08-02-full-system-architecture-and-lifecycles.md` |

---

## 1. Returns

Medusa return states: `requested | received | partially_received | canceled`. Alkemart layers approval/refund flow and dispute escalation on top via routes + metadata.

### 1.1 Flow

```
buyer requests return (storefront)
  → order.return_requested event → return-lifecycle-notify:
        vendor SMS + admin WhatsApp (immediate)
  → VENDOR (ghana-vendor returns.tsx):
        approve                → proceeds to admin/refund path
        decline                → REQUIRES typed reason (inline dialog; no canned text)
  → ADMIN (/admin/returns, /admin/returns/[id]):
        approve | reject (reason → buyer SMS) | refund
  → refund path: return.metadata.{payment_id, payment_status} locate the original
        charge → Paystack refund → payment_status updated
```

### 1.2 Sanctioned `return.metadata` keys

| Key | Meaning |
|---|---|
| `payment_id`, `payment_status` | link to original charge for refund execution |
| `is_disputed` | escalated to dispute (§2) |
| `dispute_reason`, `dispute_opened_at` | dispute context |
| `resolution`, `resolution_note`, `resolved_at` | outcome (`favor_buyer | favor_seller | partial`) |

## 2. Disputes = Returns + Metadata (deliberate)

There is **no separate dispute entity**. A dispute is a return with `metadata.is_disputed = true`.

**Why:** a dispute is a *view* over a return with extra state. A separate entity would duplicate the money linkage (`payment_id`) and demand two-way sync. **Revisit** only if disputes acquire independent lifecycle needs (evidence uploads, arbitration threads, SLAs).

```
return escalates → metadata.is_disputed = true (+ reason, opened_at)
  → admin /admin/disputes (list = returns filtered by flag), /admin/disputes/[id]
  → resolve modal: favor_buyer → refund path | favor_seller → close | partial → partial refund
  → metadata.{resolution, resolution_note, resolved_at} written
```

Admin UI: `disputes.tsx` (list + resolve modal); unknown-typed metadata rendered via explicit narrowing (`String(...)`, ternaries) — never `any`.

## 3. Payouts

### 3.1 Entities (Mercur payout module)

- **PayoutAccount** — per seller; holds Paystack `recipient_code` (created during Ghana onboarding from MoMo details).
- **Payout** — a settlement record.
- Provider: `src/modules/paystack-payout` → Paystack **transfers** to seller MoMo.

### 3.2 Flow (today: manual)

```
admin /admin/payouts (admin app payouts.tsx → Trigger Payout dialog):
  POST /admin/payouts { seller, amount (GHS→pesewas), note }
    → validates seller has a valid Paystack recipient
    → payout module → paystack-payout provider → Paystack transfer
  GET /admin/payouts           → list all
  GET /admin/payouts/[id]      → detail
```

### 3.3 Commission

- Source of truth: `seller.metadata.commission_bps` (1000 = 10%), set via `/admin/sellers/[id]/commission`; platform-level defaults in `/admin/commission-rates`.
- Applied at payout computation: `payout = order_total − commission`.
- Mercur ships a `Commission` entity (`@mercurjs/types`) not yet adopted — converging `commission_bps`/commission-rates onto it is part of the auto-payout work (task #10).

### 3.4 Target state (task #10)

```
order delivered/completed → subscriber/job computes seller balance
  → automatic Payout creation → paystack-payout transfer → seller SMS
  (admin trigger remains as manual override)
```

Design constraints for that work:
- Idempotency: one payout per order-slice; retries must not double-pay (Paystack transfer reference = deterministic key).
- Returns/disputes hold: no auto-payout while an open return/dispute exists on the order.
- All computation in pesewas; bps math server-side only.

## 4. Invariants

1. Refunds always flow through the recorded `payment_id` — never a free-form transfer.
2. Vendor decline **must** carry a typed reason; buyer-facing rejections always include it.
3. Dispute resolution writes are append-style (resolution fields set once); reopening = new escalation.
4. Payout triggers validate recipient existence **before** creating the Payout record.

## 5. Test Coverage

- `e2e/tests/refund.spec.ts`
- Return/dispute admin flows covered by panel e2e; payout automation tests land with task #10.
