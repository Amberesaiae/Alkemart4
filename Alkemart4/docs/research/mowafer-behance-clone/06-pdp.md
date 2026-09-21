# 06 — Product detail (PDP)

**Boards:** mobile PDP in `boards/app-screens.png`; journey board comparison fork; prior archive analysis of “Other Prices.”

---

## Job of the page

Answer: what is it, who sells it, what else costs, can I buy now.

Mowafer’s differentiator on PDP is the **Other Prices / Retailers** table. Alkemart’s native equivalent is **peer seller offers** on the same product — not external scrapers.

---

## Anatomy

```
┌──────────────┬────────────────────────────┐
│ Gallery      │ Title                      │
│ (main+thumbs)│ Brand / seller             │
│              │ Price                      │
│              │ Qty stepper                │
│              │ Specs | Reviews tabs       │
│              │ Primary: Add to Cart       │
│              │ Secondary: wishlist/share  │
└──────────────┴────────────────────────────┘
│ Other Prices / Other sellers              │
│  seller · price · (optional ETA) · CTA    │
└───────────────────────────────────────────┘
```

---

## Blocks

| Block | Spec | Alkemart note |
|-------|------|---------------|
| Gallery | Large image + thumb row | Existing gallery primitives |
| Title | Bold, wrap allowed | — |
| Seller | Named, links to shop | Required for multi-vendor trust |
| Price | Single primary price in buy column | Do not print price twice |
| Qty | − / + steppers | — |
| Tabs | Specs / Reviews | Hide empty tabs; no bare counts |
| Add to Cart | Yellow primary pill | Toast on success |
| Other sellers | Table/list of peer offers | Only when `offerCount > 1`; honest empty otherwise |

---

## Other sellers (clone of Other Prices)

Mowafer columns: retailer name · price.

Alkemart columns:

| Column | Source |
|--------|--------|
| Seller name | Offer seller |
| Price | Offer price (GHS) |
| Optional | Rating / delivery band when data exists |
| Action | Select offer / Add |

Selecting a peer offer updates the buy panel’s active offer — one cart line identity at a time.

---

## shadcn / Radix mapping

| Piece | Component |
|-------|-----------|
| Qty | `Button` pair + read-only value |
| Specs/Reviews | `Tabs` |
| Add to Cart | `Button` primary |
| Peer offers | `Table` or stacked `Card` rows |
| Share / wishlist | icon `Button` (wishlist deferred) |
| Mobile buy bar | sticky `Button` bar under 768px |

---

## Acceptance

- [ ] One price owner on the page (buy panel)
- [ ] Seller always named
- [ ] Peer offers section appears when multiple offers exist
- [ ] No invented % off or stock meters
- [ ] Add to Cart shows confirmation feedback
- [ ] Reviews tab never shows a bare number without a noun
