# Mercur vendor RBAC → sellable catalog runbook

| Field | Value |
|---|---|
| **Date** | 2026-07-16 |
| **Status** | Live-proven on clean-slate (`localhost:9000`) |
| **Goal** | Realistic seller path without seed inject of fake catalog rows |

---

## Critical auth model

| Surface | Auth actor | Notes |
|---------|------------|--------|
| Vendor API `/vendor/*` | **`member`** | `POST /auth/member/emailpass` — **not** `seller` |
| Header | **`x-seller-id: sel_…`** | Required after member has ≥1 seller membership |
| Admin API `/admin/*` | **`user`** | `POST /auth/user/emailpass` |

Registering only via `/auth/seller/emailpass` leaves `actor_id` empty and returns **Unauthorized** on vendor routes.

---

## End-to-end path (proven)

### 1. Member register + login

```bash
curl -s -X POST http://localhost:9000/auth/member/emailpass/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"member.tema@alkemart.local","password":"VendorPass123!"}'

# After seller exists, login yields actor_id = mem_…
curl -s -X POST http://localhost:9000/auth/member/emailpass \
  -H 'Content-Type: application/json' \
  -d '{"email":"member.tema@alkemart.local","password":"VendorPass123!"}'
```

### 2. Create seller account (unregistered member token OK)

```bash
curl -s -X POST http://localhost:9000/vendor/sellers \
  -H "Authorization: Bearer $MEMBER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Tema Fresh Goods",
    "handle": "tema-fresh",
    "email": "member.tema@alkemart.local",
    "currency_code": "ghs",
    "member_email": "member.tema@alkemart.local",
    "first_name": "Ama",
    "last_name": "Mensah",
    "address": {
      "address_1": "Community 1 Market",
      "city": "Tema",
      "country_code": "gh"
    }
  }'
# → status: pending_approval
```

### 3. Admin approve seller

```bash
curl -s -X POST http://localhost:9000/admin/sellers/$SELLER_ID/approve \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{}'
# → status: open
```

### 4. Product request flow

With product request flow enabled, vendor may only create **`draft` | `proposed`**:

```bash
curl -s -X POST http://localhost:9000/vendor/products \
  -H "Authorization: Bearer $MEMBER_TOKEN" \
  -H "x-seller-id: $SELLER_ID" \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Golden Palm Cooking Oil 1L",
    "handle": "golden-palm-oil-1l",
    "status": "proposed",
    "attributes": [{ "title": "Size", "values": ["1L"], "is_variant_axis": true }],
    "variants": [{ "title": "1L", "sku": "TEMA-PALM-1L", "options": { "Size": "1L" } }]
  }'
```

Admin confirm:

```bash
curl -s -X POST http://localhost:9000/admin/products/$PRODUCT_ID/confirm \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{}'
# → status: published
```

### 5. Ops prerequisites for offers

| Step | Endpoint |
|------|----------|
| Stock location | `POST /vendor/stock-locations` |
| Link location ↔ sales channel | `POST /vendor/stock-locations/:id/sales-channels` `{ "add": ["sc_…"] }` |
| Shipping profile | `POST /vendor/shipping-profiles` |
| Offer (price + inventory) | `POST /vendor/offers` |
| Product ↔ sales channel | `POST /vendor/sales-channels/:id/products` `{ "add": ["prod_…"] }` |
| Product ↔ seller (store list filter) | `POST /admin/products/:id/sellers` `{ "add": ["sel_…"] }` |

Offer body (GHS major units):

```json
{
  "sku": "TEMA-PALM-1L-OFFER",
  "variant_id": "variant_…",
  "shipping_profile_id": "sp_…",
  "inventory_items": [{
    "title": "Unit",
    "sku": "TEMA-PALM-1L-INV",
    "required_quantity": 1,
    "stock_levels": [{ "location_id": "sloc_…", "stocked_quantity": 50 }]
  }],
  "prices": [{ "amount": 45, "currency_code": "ghs" }]
}
```

### 6. Store visibility checks

```bash
# Products (requires product_seller link + published + sales channel)
curl -s "http://localhost:9000/store/products?limit=5&region_id=$REGION_ID&fields=*variants.calculated_price,variants.offer_id" \
  -H "x-publishable-api-key: $PK"

# Offers
curl -s "http://localhost:9000/store/offers?limit=5&region_id=$REGION_ID" \
  -H "x-publishable-api-key: $PK"

# Cart line — Mercur requires offer_id
curl -s -X POST "http://localhost:9000/store/carts/$CART_ID/line-items" \
  -H "x-publishable-api-key: $PK" -H 'Content-Type: application/json' \
  -d '{"offer_id":"offer_…","quantity":1}'
```

---

## Live fixture (2026-07-16)

| Entity | Id / value |
|--------|------------|
| Seller | `sel_01KXN9F2N1AQHYV0YWJHFTGZER` Tema Fresh Goods |
| Member | `member.tema@alkemart.local` / `VendorPass123!` |
| Product | `prod_01KXN9GVSNFQWVQZYSKBRA9ATP` Golden Palm Cooking Oil 1L |
| Variant | `variant_01KXN9HEDS49HMW3TVER1KV8CN` |
| Offer | `offer_01KXN9KW1HTCNJHD0BP02J75E4` **GH₵ 45** |
| Region | `reg_01KXMNJCTK5K5F60RB4FEJS59K` Ghana/GHS |
| Sales channel | `sc_01KXMN56SN3RSCSP55KE3A8BD4` |

Also present: earlier seller `Accra Market Collective` (`vendor.accra@alkemart.local`) — password unknown in this session.

---

## SPA implications

1. List/retrieve products with `region_id` + fields that include `variants.calculated_price` / `variants.offer_id`.
2. Cart add prefers **`offer_id`** (hooks-cart `lineItemBody`).
3. Vendor UI URL: `http://localhost:9000/seller` (or `:7001` proxy) — use **member** login in panel.

---

## Paystack (clean slate)

- Module: `apps/backend/packages/api/src/modules/paystack`
- Client: `src/lib/paystack-client.ts`
- Registered in `medusa-config.ts` **only when** `PAYSTACK_SECRET_KEY` is set
- Next: enable provider on Ghana region + SPA payment session when keys available

---

## Product request flow note

If vendor POST rejects `published` with:

> When the product request flow is enabled, status must be one of: draft, proposed

…use `proposed` + admin `…/confirm`. That is intentional RBAC, not a bug.
