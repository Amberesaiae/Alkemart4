# Railway deploy, panel performance, storefront mobile WCAG

| Field | Value |
|-------|--------|
| **Date** | 2026-07-20 |
| **API tree** | `/home/amber/alkemart-backend` (canonical for Railway) |
| **Shop tree** | `/home/amber/alkemart-storefront` (Vercel) |
| **Monorepo** | `/mnt/c/src/Alkemart4` — source of truth for git; **slow for vite** on WSL |

Full Railway procedure: **`/home/amber/alkemart-backend/docs/RAILWAY_DEPLOY.md`**.

---

## 1. Railway deploy approach (documented)

### Correct path (repeatable)

```
Linux home disk: /home/amber/alkemart-backend
  → build admin + vendor panels (MERCUR_BACKEND_URL)
  → medusa build + bundle-dashboards
  → strip workspace:* from artifact package.json
  → copy scripts/ into .medusa/server/scripts/
  → railway up --detach   # .railwayignore = tiny upload
```

### Wrong path (why “nothing was building”)

- Building under **`/mnt/c/...`** → Vite multi-minute hang / stuck `D` state  
- `railway up` without ignore → upload **500** or multi‑GB  
- Building panels **inside** Docker → OOM / TS graph failure  

### Speed expectations after fixes

| Step | Target |
|------|--------|
| Panel builds (home disk) | ~30–40s each |
| medusa + bundle | ~20–40s |
| railway up (ignore) | ~30–90s |
| Docker install + patch | ~45–90s |
| **Total** | **~3–6 min** warm machine — not 30+ min |

---

## 2. Seller / Admin slow render — root cause & fix

### Measured (production)

| Asset | Size |
|--------|------|
| `/seller/assets/index-*.js` | **~7.2 MB** raw |
| `/dashboard/assets/index-*.js` | **~7.0 MB** raw |
| CSS each | ~130 KB |
| Static cache | was **`max-age=0`** |
| Gzip | was **off** (Express default) |

Mercur `DashboardBase` does:

```js
express.static(buildDir)  // no maxAge, no compression
```

### Fixes shipped in API image

1. **`scripts/start-with-compression.mjs`** — gzip all compressible responses  
2. **`scripts/patch-dashboard-static.mjs`** — `maxAge: "365d", immutable: true` on hashed static  
3. Documented residual: **7MB monolith is upstream Mercur**; real split requires dashboard package work  

### What users should feel after redeploy

- First load: still heavy (parse 1.8MB gzip ≈ still big) but **~4× less network**  
- Second load: **cached** assets (instant shell)  
- HTML TTFB still ~1s (API process) — separate from JS size  

### Future (not done here)

- Route-level code-split in `@mercurjs/admin` / `@mercurjs/vendor`  
- CDN in front of Railway for `/dashboard/assets` + `/seller/assets`  
- Preload only login chunk if/when split exists  

---

## 3. Storefront mobile WCAG — thorough route audit

### Routes inventoried

`/`, `/about`, `/account`, `/browse/$slug`, `/cart`, `/categories/$slug`, `/checkout`, `/checkout/pending`, `/contact`, `/help`, `/login`, `/order/$id`, `/orders`, `/partners`, `/privacy`, `/product/$id`, `/search`, `/sell`, `/sellers`, `/shops`, `/shops/$slug`, `/signin` → login.

### Global (already good)

- Skip link, `main` landmark, focus-visible rings, reduced-motion  
- Header: 44px targets, search not crushed on mobile  
- Auth: distinct Sign in (dark) vs Create (gold)  
- PLP: Featured chip grid + view right; filters disclosure  

### Gaps found (subtle / mobile)

| Severity | Issue | Where | Fix status |
|----------|--------|--------|------------|
| Medium | Type **&lt;12px** hard to read / WCAG 1.4.4 zoom interaction | checkout stepper `text-[10px]`, product card `text-[11px]`, header captions `0.65rem` | **Fixed** → `text-xs` / `type-sm` |
| Medium | `outline-none` without strong `focus-visible` on search/forms | `search.tsx`, `form-field.tsx` | **Fixed** ring tokens |
| Low | Decorative images empty `alt` | mosaic, how-it-works, delivery | OK if pure decoration + parent has name |
| Low | Footer/payment labels `text-[11px]` uppercase | footer | Acceptable as non-essential chrome; prefer `type-sm` later |
| Medium | Safe-area / horizontal clip on notched phones | global | **Fixed** env(safe-area) + overflow-x clip |
| Info | PLP filter chip grids | listing | Done earlier |
| Info | Account menu Sign in / Create distinct | `__root` | Done earlier |

### Remaining manual QA (mobile Safari + Chrome)

1. Tab through header → search → cart → account menu  
2. PLP: Filters open/close, Featured chips, grid/list  
3. Checkout stepper readable at 200% zoom  
4. Login segmented control + submit contrast  
5. Forms: every field has visible label (not placeholder-only)  

### Patterns to avoid on new work

- `text-[10px]` / `text-[11px]` for **required** UI copy  
- Icon-only controls under **44×44** without `min-h-11 min-w-11`  
- `outline-none` without `focus-visible:ring-*`  
- Dark auth shells for seller/admin (use cream + `color-scheme: light`)  

---

## 4. Two-tree map (avoid thrash)

| Concern | Path |
|---------|------|
| Railway prebuild + up | `/home/amber/alkemart-backend` |
| Vercel shop | `/home/amber/alkemart-storefront` |
| Git / PR | `/mnt/c/src/Alkemart4` (sync **after** verify on home trees) |

Copy CSS/TS from monorepo → home backend, build, deploy; then copy proven files back to monorepo for commit.
