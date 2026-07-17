# Alkemart branding — Seller Hub & Admin UI

| Field | Value |
|-------|--------|
| **Date** | 2026-07-17 |
| **Goal** | User-facing UI never says Mercur/Medusa; yellow/black/white alkemart look |

## What shoppers / sellers / ops see

| Surface | Document title | Login brand |
|---------|----------------|-------------|
| Buyer storefront | `… · alkemart` | alkemart. |
| Seller Hub | `alkemart Seller Hub` | alkemart. + “Seller Hub” |
| Admin | `alkemart Admin` | alkemart. + “Admin” |

Env vars may still be named `VITE_MERCUR_*` / backend package names — **code internals only**, not UI copy.

## How branding is applied

### Seller Hub & Admin (`apps/backend/apps/{vendor,admin}`)

1. **`index.html`** — title + favicon + theme-color  
2. **`public/logo.svg`** — alkemart mark (black + yellow)  
3. **`src/styles/alkemart-brand.css`** — CSS variable overrides + primary button yellow  
4. **`src/widgets/login-brand.tsx`** — login zone wordmark (`login.logo.replace`)  
5. **`src/main.tsx`** — import brand CSS after panel CSS; set `document.title`

### Storefront

- `/sell` — “Sell on alkemart” entry → Seller Hub register/login  
- Footer / partners — “Seller Hub” / “Admin” labels only  

## Limits

- Deep panel chrome is still the Medusa/Mercur dashboard shell; we **theme + wrap**, not full redesign of every screen.  
- Some hard-coded English strings inside `@mercurjs/*` packages may still appear until upstream i18n overrides cover them.  
- After changing brand files, **restart** vendor/admin Vite (or API if panels are served from the backend build).

## Restart (local)

```bash
# Seller Hub (if running standalone)
cd apps/backend/apps/vendor && bun run dev   # :7001 or via API /seller

# Admin
cd apps/backend/apps/admin && bun run dev    # :7000 or via API /dashboard
```

If panels are bundled into the API process, rebuild/restart that process so HTML/CSS updates load.
