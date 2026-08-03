# Alkemart4 Platform

## Railway Deployment

**Project:** comfortable-success (`8e3b8293-9aee-48f9-a999-aa69ded1c1e9`)
**Service:** alkemart-api (`d40d0dc9-27d9-4f8a-8fd5-a905f74bb6a6`)
**Environment:** production (`bf2ac87f-f183-431e-903b-0392d95f90d0`)
**URL:** https://alkemart-api-production.up.railway.app

CLI context: `/home/amber/Desktop/amber/Alkemart4`

### Known build fix: hoist workspace deps

If `bun run build` from `apps/backend` fails with module-not-found errors for
`@radix-ui/*`, `sonner`, or `tailwindcss-animate`, add them as direct
dependencies in `apps/backend/package.json` so bun's workspace hoisting
makes them available to the bundler. Run `bun install` after adding.

### Build failure: Rollup cannot resolve @radix-ui/* / sonner / tailwindcss-animate

The vendor dashboard (`apps/ghana-vendor`) and admin dashboard (`apps/admin`) use components from `packages/ui` which depend on Radix primitives, sonner, and tailwindcss-animate. These are listed in `packages/ui/package.json` but when Railway builds, bun's workspace hoisting may not make them available to the vendor build's rollup bundler.

**Fix:** Add the missing deps to `apps/backend/package.json` as direct dependencies:
```
@radix-ui/react-checkbox, @radix-ui/react-switch, @radix-ui/react-tabs, sonner, tailwindcss-animate
```

Then run `bun install` from `apps/backend/` and push.

### force-ipv4-dns workaround

On some WSL/networks Neon resolves to IPv6 first and TCP hangs (ETIMEDOUT),
while IPv4 works. The file `packages/api/src/lib/force-ipv4-dns.ts` calls
`dns.setDefaultResultOrder("ipv4first")` and is imported first in
`medusa-config.ts` before any database clients load. This is a deployment
workaround, not a general DNS change — it only affects the Node process.

### CJS runtime invariant — the API boots via CommonJS (ts-node)

Medusa's CLI loads `medusa-config.ts` through a CJS `require()`. The **entire config-loading
tree — the config plus every workspace package it pulls in at runtime — must be loadable as
CommonJS**. Breaking this has caused two separate deploy crashes. There are two rules:

**1. ts-node must emit CommonJS** (config-load crash: `Unknown file extension ".ts"` +
`loadESMFromCJS`).

`packages/api/tsconfig.json` is `module: "ESNext"` because `medusa build` (which runs under
tsx) needs it. The `ts-node` block overrides that for the runtime so swc emits CJS:

```jsonc
"ts-node": {
  "swc": true,
  "compilerOptions": { "module": "CommonJS", "moduleResolution": "Node" }
}
```

Do not remove this override, and do not flip the base tsconfig back to `"module": "Node16"`
to "simplify" — ESNext + `rewriteRelativeImportExtensions` is what keeps `medusa build` green.

**2. No runtime-required workspace package may carry `"type": "module"`** (route-registration
crash: `Must use import to load ES Module: ...package.json contains "type": "module"` /
`ERR_REQUIRE_ESM`).

ts-node's CJS loader refuses any `.ts` file whose nearest package.json has `"type": "module"`.
`packages/shared` (`@alkemart/shared`, required by `packages/api/src/lib/ghana-locale.ts`)
**must stay CommonJS-scope — never add `"type": "module"` to it.** The Vite apps
(`apps/storefront`, `apps/ghana-vendor`, `apps/admin`) transform `.ts` source regardless of
the `type` field, so leaving it off breaks nothing on the frontend. Any new workspace package
the API imports must also stay CJS-scope (no `type` field) unless it is only bundled.

Related, already-fixed pieces (keep them): Node runtime pinned in `.tool-versions`
(`node 20.20.2`) and `package.json` engines (`20.x`); relative imports inside `packages/api`
use explicit `.ts` suffixes (resolved fine by the ts-node CJS hook).

**Deploy gate:** after a push, confirm in `railway logs -s alkemart-api <deploy_id> --lines 300`
that `Server is ready on port: 9000` appears. That line only prints after ALL loaders (incl.
API route registration) complete. A crash shows `Error starting server: An error occurred
while registering API Routes`.

**Quick static check before pushing:**
```bash
cd apps/backend && (rg -n '"type": "module"' packages/shared/package.json && echo "FIXME: ESM-scope package required at runtime") || echo "ok"
```

Fix history (for blame): `f65a26f` node pin + `.ts` sweep · `67136e5` ts-node CJS override ·
`fe116c6` dropped `"type": "module"` from `packages/shared`. Regressions that broke it:
`1812c37` (ESNext base) and `041be00` (added `ghana-locale.ts`).

### Storefront node_modules shadowing

The storefront at `apps/storefront` had a stale `node_modules/@radix-ui/` directory from its previous pnpm setup that only contained `react-avatar` and `react-slot`. This shadowed the hoisted root `node_modules/@radix-ui/` which has all radix packages.

**Fix:** Remove the stale directories from `apps/storefront/node_modules/` and delete `pnpm-workspace.yaml`. The root `package.json` already lists `apps/storefront` in its bun workspaces.

### UI Component patterns

All admin dashboard pages (`apps/admin/src/routes/_authenticated/`) use `@workspace/ui` primitives as their foundation:
- `EmptyState` for empty/zero-state
- `Price` for safe price formatting (handles null/undefined)
- `Card`, `CardHeader`, `CardContent`, `CardTitle` for card layouts
- `Badge` for status indicators
- `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` for data tables (built-in overflow-auto)
- `Button` for actions, `Modal` for dialogs, `Textarea` for input
- `Skeleton` for loading states

### Admin sidebar conventions

- Background: `bg-ink` (#1a1a1a), text: `text-white`
- Nav items: `px-4 py-3 rounded-xl text-sm font-bold`, icons `h-5 w-5`
- Active: `bg-primary text-primary-foreground shadow-md`
- Inactive: `text-white/70 hover:bg-white/10 hover:text-white`
- Sign out uses plain `<button>` with same classes as nav items (not `Button` component)
- Collapsible: `w-64` expanded, `w-16` collapsed
- Height: `min-h-screen` (not `h-screen`)
- Separator: `<hr className="border-white/10 mx-4" />`

### Loading skeleton best practices

- Group title + description skeletons in `space-y-2` wrapper
- Match skeleton dimensions to actual content (varied widths for table cells)
- Include action button skeletons in card layouts
- Use `CardHeader` + `CardContent` skeleton structure for card-based pages

---

## Ghana locale — single source of truth

**`packages/shared/src/ghana/`** (`@alkemart/shared/ghana`) is the canonical source for all Ghana geographic, currency, phone, and payment data.

| What | Canonical location |
|---|---|
| 16 region names (string list) | `@alkemart/shared/ghana` → `GHANA_REGIONS_LIST` |
| Region objects (id/capital/iso/lat/lon) | `@alkemart/shared/ghana` → `GHANA_REGIONS` |
| Major cities list | `@alkemart/shared/ghana` → `GHANA_MAJOR_CITIES` |
| Address field copy (labels/placeholders) | `@alkemart/shared/ghana` → `GHANA_ADDRESS_COPY` |
| MoMo providers (display metadata) | `@alkemart/shared/ghana` → `MOMO_PROVIDERS` |
| Paystack MoMo slugs (runtime type) | `@alkemart/shared/ghana` → `PaystackMomoProvider` |
| Phone formatting/detection | `@alkemart/shared/ghana` → `formatPhone`, `detectMobileOperator` |
| Currency helpers | `@alkemart/shared/ghana` → `GHS`, `formatGHS`, `pesewasToMajor` |

**Never** create a copy of these in `apps/storefront/src/lib/`, `apps/backend/packages/api/src/lib/`, or `apps/backend/apps/ghana-vendor/src/lib/`. Those files now re-export from `@alkemart/shared/ghana`.

Backend-only copy helpers (`GHANA` config object, `isGhanaCountry`) remain in `packages/api/src/lib/ghana-locale.ts` since they are used only by seed/setup scripts.

## Admin payouts list route

`GET /admin/payouts` (list, filterable by seller_id and status) is implemented in `packages/api/src/api/admin/payouts/route.ts`. The detail route is at `packages/api/src/api/admin/payouts/[id]/route.ts`. Triggering a payout still requires the Mercur payout workflow — the admin UI should call `POST /admin/payouts` with the Mercur API shape.

## MoMo TTL job

`jobs/momo-payment-ttl.ts` expires abandoned MoMo carts every 5 minutes. It uses `Modules.CART` service (not raw SQL). If you need to change the TTL, update the `TTL_MS` constant in that file and the matching `MOMO_PENDING_TTL_MS` constant in `lib/ghana-checkout.ts`.

## Data flow reference

See `docs/architecture/2026-08-02-canonical-data-flow.md` for the complete entity model, lifecycle flows (vendor → product → order → payout), workflow/subscriber map, atomicity analysis, and editability matrix.
