# P0 performance checklist (printable)

Copy of the P0 table from [2026-07-19-performance-practices.md](./2026-07-19-performance-practices.md). Tick when done.

## Environment

- [ ] **P0.1** Neon plan ≥ Launch (not free_v3) for production project  
- [ ] **P0.2** Scale-to-zero **disabled** on medusa-prod compute (`ep-restless-lab-at072v3y`)  
- [ ] **P0.3** `DATABASE_URL` = pooled (`-pooler`); migrations use unpooled  
- [ ] **P0.4** Single listener on `:9000` (`ss -ltnp | grep 9000`)  
- [ ] **P0.5** Keep-warm only if still on free; removed after P0.2  
- [ ] **P0.6** Smoke:

```bash
curl -s -o /dev/null -w "health %{time_total}s %{http_code}\n" http://127.0.0.1:9000/health
curl -s -o /dev/null -w "catalog %{time_total}s %{http_code}\n" \
  -H "x-publishable-api-key: $PK" \
  "http://127.0.0.1:9000/store/alkemart/catalog?limit=5"
```

## Isolation (shipped — re-verify after restarts)

- [ ] Unit: `bun test src/lib/__tests__/strict-seller-products.unit.spec.ts`  
- [ ] Live: vendor products for a known seller show **no** lab orphan titles  
- [ ] New empty shop: product list empty until create  

## P1.3 indexes (shipped 2026-07-19)

- [x] Core: `IDX_offer_seller_id`, `IDX_offer_product_id`, `IDX_product_status`, `product_seller(seller_id)`  
- [x] Composites: `IDX_alkemart_offer_seller_product`, `IDX_alkemart_offer_product_seller`  
- [x] Category reverse: `IDX_alkemart_pcp_category_id` on `product_category_product`  
- Re-apply on new DBs: `bash scripts/ensure-p13-marketplace-indexes.sh`

## Notes

| If stuck on free | Expect cold freezes; use `bash scripts/neon-keep-warm.sh --loop` while developing |
| After Launch always-on | Delete reliance on keep-warm for prod |
