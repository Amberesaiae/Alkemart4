# Storefront on Vercel — production settings (e2e-ready)

| Field | Value |
|-------|--------|
| **Date** | 2026-07-19 |
| **Project** | `alkemart-storefront` (team: isaiahamber5-6265s-projects) |
| **Production** | https://alkemart-storefront.vercel.app |
| **What** | Buyer SPA only — **not** Medusa API / Neon / Redis |

Medusa API, Neon, Redis, Paystack, admin, and seller panels run **outside** Vercel. Vercel only serves the Vite SPA (`dist/`) with SPA rewrites.

---

## Settings checklist (Dashboard → Project → Settings)

Use this against every left-nav item. **Bold = do now for production quality.**

### General

| Setting | Recommended |
|---------|-------------|
| **Project Name** | `alkemart-storefront` |
| **Framework Preset** | Other (null) — we set build via `vercel.json` |
| **Root Directory** | `.` when deploying from storefront repo/dir (`apps/storefront` if monorepo-linked) |
| **Node.js Version** | 22.x or 24.x (current project uses 24.x) |
| **Build Command** | `bun run build` (from `vercel.json`) |
| **Output Directory** | `dist` |
| **Install Command** | `bun install` |
| **Ignored Build Step** | leave default (or skip builds when only docs change) |

### Build and Deployment

| Setting | Recommended |
|---------|-------------|
| **Production Branch** | Prefer `main` once feature branch is merged; until then deploy CLI/`feat/*` manually with `--prod` only when intentional |
| **Automatic deployments** | On for Git (see Git) |
| **On-Demand Concurrent Builds** | On if available (faster PR previews) |
| **Build Machine** | Standard is fine for this SPA |
| **Prioritize Production Builds** | **On** |

### Environments

| Env | Purpose |
|-----|---------|
| **Production** | Live `alkemart-storefront.vercel.app` |
| **Preview** | PR / branch deploys — can use same API **or** a staging API later |
| **Development** | `vercel dev` / env pull for local |

**Production env vars (required for real e2e):**

| Variable | Production value |
|----------|------------------|
| `VITE_MEDUSA_BACKEND_URL` | **Public HTTPS API** (not `http://localhost:9000`) |
| `VITE_MEDUSA_PUBLISHABLE_KEY` | Live publishable key from Admin |
| `VITE_MEDUSA_REGION_ID` | Ghana region id |
| `VITE_MEDUSA_SALES_CHANNEL_ID` | Store sales channel |
| `VITE_PUBLIC_SITE_URL` | `https://alkemart-storefront.vercel.app` |
| `VITE_HOME_DEMO` | `0` |
| `VITE_SHOW_ADMIN_LINK` | `false` (no admin in shop chrome) |
| `VITE_SHOW_OPS_PARTNERS` | `false` unless ops need it |
| `VITE_MERCUR_VENDOR_URL` | Public seller hub URL only when ready |
| `VITE_PUBLIC_POSTHOG_*` | Optional analytics |

**Do not set on Vercel:** `DATABASE_URL`, Redis, Paystack secret keys — those belong on the API host.

After any env change:

```bash
cd /home/amber/alkemart-storefront   # or apps/storefront
vercel deploy --prod --yes
```

Vite inlines `VITE_*` at **build** time — redeploy is mandatory.

### Git

| Setting | Recommended |
|---------|-------------|
| **Connected repo** | `Amberesaiae/Alkemart4` (or storefront-only repo if split) |
| **Production Branch** | `main` after merge |
| **Deploy Hooks** | Optional |
| **Include files outside Root Directory** | Off unless monorepo needs shared packages |

**CLI deploy (works without Git production branch):**

```bash
cd /home/amber/alkemart-storefront
vercel link --yes --project alkemart-storefront
vercel deploy --prod --yes
```

### Deployment Protection

| Setting | Recommended |
|---------|-------------|
| **Production** | **None** (public shop) |
| **Preview** | Vercel Authentication **or** password for unreleased work |
| **Protection Bypass for Automation** | Create secret if CI needs to hit previews |

### Passport / Beta / Microfrontends

| Item | Action |
|------|--------|
| Passport | Skip (not needed for SPA shop) |
| Microfrontends | Skip |
| Beta features | Enable only if documented; default off |

### Functions

Not used for this static SPA. No serverless routes required; do not add Node functions unless you intentionally move API surface onto Vercel.

### Cron Jobs

Not for the shop SPA. Keep-warm / catalog warm belongs on the **API** host (or external cron hitting public API health).

### Project Members

Invite only trusted ops; Hobby/Pro seat limits apply.

### Drains

Optional: ship build/runtime logs to Axiom/Datadog later. Not required for first e2e.

### Security

| Setting | Recommended |
|---------|-------------|
| **Attack Challenge Mode** | Off for normal traffic; On only during abuse |
| **Bot Protection** | Default managed rules OK |
| **Headers** | Set in `vercel.json` (X-Frame-Options, nosniff, Referrer-Policy, cache assets) — already in repo |

### Networking

| Setting | Recommended |
|---------|-------------|
| **Custom domain** | Add shop domain when ready; set `VITE_PUBLIC_SITE_URL` to match |
| **IPv6 / CDN** | Default Vercel edge is fine |

### Activity / Advanced

Use Activity for deploy history and rollbacks. Advanced: leave defaults unless debugging monorepo roots.

---

## What Vercel does **not** fix (e2e blockers)

1. **API must be public HTTPS** — shop on Vercel calling `localhost:9000` only works on the developer machine.
2. **CORS on Medusa** must allow the Vercel origin:

```text
STORE_CORS=https://alkemart-storefront.vercel.app
AUTH_CORS=https://alkemart-storefront.vercel.app
```

3. **Neon free tier cold starts** — keep Redis catalog cache + keep-warm on the API host; do not install Neon via Vercel Marketplace for this project (already on marketplace DB).
4. **Admin / Seller** — private URLs, not on this Vercel project.

---

## E2E readiness matrix

| Surface | Where it runs | Status when shop is on Vercel only |
|---------|---------------|-------------------------------------|
| Home / PLP shell | Vercel CDN | ✅ Static shell loads fast |
| Catalog / search / cart API | Medusa host | ❌ until public `VITE_MEDUSA_BACKEND_URL` |
| Checkout COD | Medusa host | ❌ same |
| Seller / Admin panels | Separate hosts | Not on Vercel shop |
| Analytics (PostHog) | Client → PostHog | ✅ if keys set |

**Full e2e path:** public API → update Production `VITE_MEDUSA_BACKEND_URL` → set CORS → `vercel deploy --prod` → smoke home → PLP → PDP → cart → checkout.

---

## Deploy commands

```bash
# Preview
vercel

# Production
vercel deploy --prod --yes

# Inspect / logs / rollback
vercel ls
vercel inspect https://alkemart-storefront.vercel.app
vercel logs https://alkemart-storefront.vercel.app
vercel rollback
```

## Env CLI (one environment at a time)

```bash
# List
vercel env ls

# Add (paste value when prompted, or pipe)
printf '%s' 'https://api.example.com' | vercel env add VITE_MEDUSA_BACKEND_URL production

# Pull for local (overwrites .env.local)
vercel env pull .env.local --environment=production --yes
```

---

## Repo files

- `vercel.json` — SPA rewrite, bun build → `dist`, security + cache headers
- Do **not** commit secrets; only `VITE_*` public config in Vercel dashboard
