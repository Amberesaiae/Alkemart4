# Public shop privacy & professional presentation

| Date | 2026-07-19 |
|------|------------|

## Rules

1. **No Admin / ops URLs** on buyer chrome (see production-public-surfaces.md).  
2. **No raw Medusa order ids** (`order_…`) in lists, errors, or primary UI — use `Order #displayId` or masked `···XXXXXX`.  
3. **No email in URL query strings** — guest lookup uses sessionStorage / form, not `?email=`.  
4. **Mask confirmation email** on order detail (`a***@domain.com`).  
5. **Analytics**: never send full order ids, emails, phones, addresses.  
6. **Support copy**: user may copy a short reference; full system id only if they explicitly need it (we prefer display id).

## Code map

| Helper | File |
|--------|------|
| `formatOrderLabel` / `maskOrderId` / `maskEmail` | `lib/orders.ts` |
| `trackOrderCompleted` (no order id) | `lib/analytics.ts` |
| Guest email storage | sessionStorage key `alkemart.storefront.order_lookup_email` |
