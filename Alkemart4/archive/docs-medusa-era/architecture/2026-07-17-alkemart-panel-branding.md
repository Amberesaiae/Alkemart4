# Alkemart branding — Seller Hub & Admin UI

| Field | Value |
|-------|--------|
| **Date** | 2026-07-17 |
| **Goal** | User-facing UI never says Mercur/Medusa; yellow/black/white alkemart look |
| **Also see** | `2026-07-17-panel-ui-ux-rebrand.md` (analytics + Recharts) |

## What shoppers / sellers / ops see

| Surface | Document title | Login brand |
|---------|----------------|-------------|
| Buyer storefront | `… · alkemart` | alkemart. |
| Seller Hub | `alkemart Seller Hub` | mark + alkemart. + “Seller Hub” |
| Admin | `alkemart Admin` | mark + alkemart. + “Admin” |

Env vars may still be named `VITE_MERCUR_*` / backend package names — **code internals only**, not UI copy.

## How branding is applied

### Seller Hub & Admin (`apps/backend/apps/{vendor,admin}`)

1. **`index.html`** — title + favicon + theme-color  
2. **`public/logo.svg`** — alkemart mark (black + yellow)  
3. **`src/styles/alkemart-brand.css`** — full chrome tokens, buttons, sidebar active, login, analytics layout  
4. **`src/widgets/login-brand.tsx`** — login zone wordmark  
5. **`src/widgets/login-footer.tsx`** — context under login form  
6. **`src/widgets/orders-list-banner.tsx`** — list chrome → Analytics  
7. **`src/routes/analytics/page.tsx`** — Recharts dashboard  
8. **`src/_navigation.ts`** — sidebar labels / ranks  
9. **`src/main.tsx`** — brand CSS after panel CSS; `document.title`

### Storefront

- `/sell` — “Sell on alkemart” entry → Seller Hub  
- Footer / partners — “Seller Hub” / “Admin” labels only  

## Analytics (Recharts)

| Panel | Data source | Isolation |
|-------|-------------|-----------|
| Admin `/analytics` | `GET /admin/alkemart/stats` | Platform-wide |
| Seller `/analytics` | Vendor `/vendor/orders|offers|products` aggregation | Seller only |

## Limits

- Deep panel chrome is still the Medusa/Mercur dashboard shell; we **theme + extend**, not fork every screen.  
- Some hard-coded strings inside `@mercurjs/*` may remain until upstream i18n covers them.  
- After changing brand files, **restart** vendor/admin Vite (or API if panels are served from the backend build).

## Restart (local)

```bash
cd apps/backend/apps/vendor && bun install && bun run dev   # :7001 /seller
cd apps/backend/apps/admin && bun install && bun run dev    # :7000 /dashboard
```
