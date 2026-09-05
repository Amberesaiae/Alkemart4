# Performance practices — Alkemart (Medusa v2 + Mercur + Neon)

| Field | Value |
|-------|--------|
| **Date** | 2026-07-19 |
| **Status** | Active guidance |
| **Audience** | Engineering + ops |
| **Related** | [NEON.md](../NEON.md), [seller-product-isolation](./2026-07-19-seller-product-isolation.md), [LIVE-E2E](./workflow-plans-2026-07-19/LIVE-E2E-2026-07-19.md) |

---

## Diagnosis (measured, not guessed)

| Call | Typical time | Hits DB? |
|------|----------------|----------|
| `GET /health` | ~5–10 ms | No |
| `POST /auth/member/emailpass` | ~1–2 s (warm) | Yes |
| `GET /store/alkemart/catalog` | ~3–7 s (warm Accra→US) | Yes, multi-SQL graph |

**Conclusion:** Medusa process is fine when idle. Slowness is **DB RTT × chatty queries**, amplified by **Neon free scale-to-zero** and **`aws-us-east-1` from Ghana**.

### Catalog is not classic app-level N+1

`GET /store/alkemart/catalog` issues **one** `query.graph` on `offer` with nested fields, then maps in memory. Under the hood Medusa may still emit **many SQL statements** per graph call — that is “chatty ORM,” not a `for product → await` loop.

### What is *not* the main bottleneck

- Storefront Vite shell  
- Brand CSS / Seller Hub theme  
- Isolation middleware (2–3 fixed ownership queries; correct and small vs RTT)  
- Paystack (checkout only)  

---

## P0 checklist — stop feeling broken

Do these before optimizing application code further.

| # | Action | Owner | Done when |
|---|--------|--------|-----------|
| P0.1 | **Neon Launch (or Scale)** for project Alkemart | Ops | Plan is not free_v3 |
| P0.2 | **Disable scale-to-zero** on `ep-restless-lab-at072v3y` (medusa-prod) | Ops | `suspend_timeout_seconds = -1` or Console “always on” |
| P0.3 | Confirm **pooled** `DATABASE_URL` for runtime, **unpooled** for migrations | Eng | `.env` has `-pooler` vs direct |
| P0.4 | **One API process** only (`bun run dev` / `medusa develop` once on `:9000`) | Eng | `ss -ltnp \| grep 9000` shows single listener |
| P0.5 | **Wake / keep-warm** only as free-tier band-aid | Eng | `scripts/neon-keep-warm.sh` during sessions; stop for paid always-on |
| P0.6 | Smoke after P0.1–4 | Eng | health &lt; 50 ms; catalog warm &lt; 2 s target (local→Neon still may be higher from GH) |

```bash
# P0.4 / smoke
curl -s -o /dev/null -w "health %{time_total}s\n" http://127.0.0.1:9000/health
curl -s -o /dev/null -w "catalog %{time_total}s\n" \
  -H "x-publishable-api-key: $PK" \
  "http://127.0.0.1:9000/store/alkemart/catalog?limit=5"
```

**Neon free note:** Cannot change suspend timeout — P0.1–P0.2 require paid. Until then use keep-warm and expect cold freezes.

---

## P1 checklist — marketplace read path

| # | Action | Why |
|---|--------|-----|
| P1.1 | Catalog: **filter + paginate product ids**, heavy load only for page | **Done 2026-07-19** — light id pass + heavy page pass (`catalog/route.ts`) |
| P1.2 | **Trim list fields** (no full description on PLP cards) | **Done 2026-07-19** — catalog heavy pass omits `product.description` |
| P1.3 | **Indexes** on `offer(seller_id)`, `offer(product_id)`, `product_seller(seller_id)`, `product(status)` where missing | **Done 2026-07-19** — core four already from Medusa/Mercur; Alkemart composites + category reverse applied via `scripts/ensure-p13-marketplace-indexes.sql` |
| P1.4 | **Redis cache** for catalog keys `(seller, category, limit, offset)` + gen bump | **Done 2026-07-19** — live smoke: miss ~12s → hit ~0.8s (`cache=hit`); key `alkemart:catalog:v1:g…` |
| P1.5 | **Meilisearch sellable-only** for search/browse | Discovery matches ATC |
| P1.6 | Isolation e2e always green | `e2e` phase 1 + `live-e2e-human-flows.sh` product isolation step |

---

## P2 checklist — geography & depth

| # | Action | Why |
|---|--------|-----|
| P2.1 | Neon region closer to users **or** API co-located with DB | Cuts base RTT (Ghana↔Virginia is structural) |
| P2.2 | Query log / count on one catalog + one vendor product list | Prove chatty vs N+1 with numbers |
| P2.3 | `/ready` = `SELECT 1` (separate from cheap `/health`) | Orchestrators detect Neon sleep |
| P2.4 | Read replica only if catalog QPS justifies | Optional |

---

## Best practices (current)

### Neon

- Pooler for long-running Medusa; direct for migrations  
- Production: **no scale-to-zero** on primary branch  
- Autoscaling min/max CU matched to concurrent connections (~100 conn / 1 GB RAM rule of thumb)  
- Keep-alive is a free-tier workaround, not architecture  

### Medusa / Mercur

- Prefer **one graph** with explicit fields over loops of queries  
- **Paginate at the data layer**  
- Mutations via **workflows + hooks** (product create → always `product_seller`)  
- Tenancy via **middleware filter rewrite**, not forking Mercur  
- Exclusive multi-vendor: **never** rely on Mercur “published + no product_seller = global list”  

### Marketplace product rules

- ATC = **offer_id** only  
- Seller list = owned only (`strict-seller-products`)  
- Store catalog = published + offer + open seller  
- No demo seed on money path (`VITE_HOME_DEMO=0`)  

### Process / ops

- Single `medusa develop` in lab; `medusa start` (or container) in prod  
- Kill zombies if `EADDRINUSE` on 9000  
- Document: API `:9000`, shop `:5175`, admin `:7000`, seller `:7001`  

---

## Code map (performance-related)

| Concern | Location |
|---------|----------|
| Catalog (light ids → heavy page) | `packages/api/src/api/store/alkemart/catalog/route.ts` + `lib/catalog-map.ts` |
| Catalog Redis cache | `packages/api/src/lib/catalog-cache.ts` + `subscribers/catalog-cache-invalidate.ts` |
| P1.3 marketplace indexes | `scripts/ensure-p13-marketplace-indexes.sql` (+ `.sh`) |
| Live E2E matrix | `docs/architecture/2026-07-19-LIVE-E2E.md` · `bun run smoke:*` |
| Exclusive seller product list | `packages/api/src/api/middlewares/strict-seller-products.ts` |
| Create → product_seller | `packages/api/src/workflows/hooks/product-created-link-seller.ts` |
| Neon ops / warm | `docs/NEON.md`, `scripts/neon-keep-warm.sh` |
| Isolation e2e | `e2e/tests/rbac-multivendor.live.spec.ts`, `scripts/live-e2e-human-flows.sh` |

---

## Explicit non-goals (for now)

| Avoid | Reason |
|-------|--------|
| Rewrite off Medusa | Region/cold start dominate |
| Microservices for “speed” | More network without co-location |
| Supabase only for latency | Same Postgres class unless region/always-on change |
| Caching cart/checkout | Correctness |

---

## Reevaluation gate

Mark performance work “in good shape” when:

1. [ ] Prod Neon always-on (or documented free-tier limits accepted)  
2. [ ] Warm catalog P95 acceptable for target geography  
3. [ ] No orphan published products without `product_seller`  
4. [ ] Vendor product isolation unit + live e2e green  
5. [ ] One clean API process in each environment  

---

## Changelog

| Date | Note |
|------|------|
| 2026-07-19 | Initial practices + P0/P1/P2 from live measurements and isolation work |
| 2026-07-19 | P1.1 catalog: light product-id pass + heavy page load; pure helpers unit-tested |
| 2026-07-19 | P1.4 Redis catalog cache (gen invalidation, TTL 15–300s, default 60) |
| 2026-07-19 | P1.4 live verified: after Redis purge, `cache=miss` ~12.2s then `cache=hit` ~0.79s / ~1.9s |
| 2026-07-19 | P1.3 indexes: verified core four present; added `IDX_alkemart_offer_{seller_product,product_seller}`, `IDX_alkemart_pcp_category_id` |
| 2026-07-19 | Pragmatic seller speed: ownership=product_seller only; Redis readiness cache; light `GET /vendor/alkemart/products`; PLP no description; banner min poll 45s |
