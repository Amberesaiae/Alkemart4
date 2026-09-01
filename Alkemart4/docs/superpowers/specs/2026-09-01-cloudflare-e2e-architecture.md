# Alkemart Cloudflare E2E architecture

**Date:** 2026-09-01  
**Postgres now:** Supabase (`alkemart`, `eu-west-1`)  
**Postgres later:** Railway (with Meilisearch + Redis)  
**API:** Cloudflare Workers + Hyperdrive  
**UIs:** store / vendor / admin on Cloudflare Pages (three apps, one API)

---

## 1. System map

```
Browsers
  store.* · vendor.* · admin.*     ← Cloudflare Pages (three apps)
           │
           ▼  OpenAPI client
      api.* (Workers Hono)
           │
     ┌─────┼──────────────┬─────────────┐
     ▼     ▼              ▼             ▼
  Hyperdrive×2          KV/DO         Paystack
  (cache+primary)    (cache/dedup)   (MoMo/card/payout)
     │
     ▼
  Supabase Postgres (now)  →  Railway Postgres (later)
```

---

## 2. Ownership

| Layer | Owns |
|---|---|
| Pages (store/vendor/admin) | UX only |
| Workers API | Auth, catalog, cart, checkout, webhooks, fulfill, payouts |
| Hyperdrive | Connection pool + optional read cache to Postgres |
| Supabase → Railway Postgres | System of record (money, stock, orders) |
| Paystack | Charges, transfers, webhook truth for MoMo |
| Railway Meili/Redis (later) | Search / optional jobs — not the ledger |

---

## 3. Speed (current Supabase choice)

1. Dual Hyperdrive: cached reads vs primary writes  
2. KV for hot catalog (nav / PLP)  
3. Keep checkout/auth/payouts on **primary**  
4. Pooled Supabase URL for Hyperdrive  
5. Prevent free-tier sleep (cron ping or upgrade when live)  
6. Three UIs on Pages CDN; one API origin  

---

## 4. Frontends — same side?

**Yes — same Cloudflare side, three separate apps, one Workers API.** Advisable.

Do **not** merge store/vendor/admin into one SPA. Do **not** leave vendor/admin on Medusa while store hits Workers.

---

## 5. Lifecycle flows (short)

1. **Browse** → sellable offers from Postgres (+ KV)  
2. **Vendor list** → proposed product+offer → admin publish  
3. **Cart** → lines bind `offerId` only  
4. **COD** → OrderGroup + per-seller Orders immediately  
5. **MoMo** → Paystack charge → pending + reserve → webhook → orders  
6. **Card** → initialize → verify/webhook → orders  
7. **Fulfill** → vendor ship/deliver (seller-scoped)  
8. **Payout** → admin trigger → Paystack Transfer − commission_bps  

---

## 6. Env / bindings checklist

### Supabase
- Project ref, DB password (local only — never commit)
- `DATABASE_URL` (direct) for Drizzle migrate
- Pooler URL for Hyperdrive origin

### Cloudflare
- `HYPERDRIVE` + `HYPERDRIVE_PRIMARY` IDs in `wrangler.toml`
- `CATALOG_KV`
- Secrets: `JWT_SECRET` (≥32), `PAYSTACK_SECRET_KEY`
- Webhook: `https://<worker>/hooks/paystack`

### Frontends
- `VITE_ALKEMART_API_URL` → Workers origin

---

## 7. Cutover

Hard switch writes to Workers. Freeze Medusa. Archive backend. No dual writers. Later: re-point Hyperdrive from Supabase → Railway Postgres; add Meili/Redis on Railway.
