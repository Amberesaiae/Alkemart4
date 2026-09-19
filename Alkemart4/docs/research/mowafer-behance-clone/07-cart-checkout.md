# 07 — Cart and checkout

**Boards:** `boards/web-cart.png`, `boards/app-checkout.png`.

---

## Principle

Checkout is a **linear state machine**, not one long form. Cart is a separate screen from checkout steps.

```
Cart → Address → Delivery → Payment → Success
```

---

## Cart (web)

Breadcrumb: `Shopping Cart › Delivery and Payment`

### Table columns

| Column | Behavior |
|--------|----------|
| Products | Thumb + title + **category colour tag** |
| Price | Unit |
| Count | − / + steppers |
| Subtotal | Line total |
| Total | Cart total |

### Mobile cart extras (app)

- Per-line wishlist / remove
- Split fee lines when applicable (Mowafer: Electronics vs Grocery delivery fees)
- Place Order CTA → checkout step 1

**Alkemart:** prefer per-seller / shipping option fee lines when data exists; never invent split fees.

---

## Checkout stepper

Icon + label stages:

1. **Address** (pin) — name, city, phone, address, Add Address
2. **Delivery** (rocket) — Standard vs Check Points / shipping options; delivery promise copy when known
3. **Payment** (card) — COD default + card options (Paystack)
4. **Success** — checkmark, order confirmed, Track / My Orders

Active step uses yellow accent; completed steps show check treatment.

---

## Payment (v1)

| Method | Status |
|--------|--------|
| Cash on Delivery | Primary where enabled |
| Card (Paystack) | Primary online path |
| Mowafer Points slider | **Non-goal v1** |

---

## Success

- Large success mark
- Clear order identity
- CTA: Track order / My Orders
- No dead end back to empty cart without explanation

---

## shadcn / Radix mapping

| Piece | Component |
|-------|-----------|
| Cart table | `Table` |
| Qty | `Button` steppers |
| Address form | `Input` · `Label` · `Textarea` · `Select` |
| Stepper | custom with `Tabs`-like state or dedicated stepper |
| Payment radios | `RadioGroup` |
| Confirm | `Button` primary |
| Success | empty-state pattern + CTAs |

---

## Acceptance

- [ ] Cart and checkout are separate routes/states
- [ ] Stepper shows Address → Delivery → Payment → Done
- [ ] COD and card both representable; points omitted
- [ ] Category/seller colour tags on cart lines when category known
- [ ] Success screen offers Track / Orders
- [ ] Mobile checkout remains single-column, thumb-reachable primary CTA
