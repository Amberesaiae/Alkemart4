# Alkemart4 Platform

## Railway Deployment

**Project:** comfortable-success (`8e3b8293-9aee-48f9-a999-aa69ded1c1e9`)
**Service:** alkemart-api (`d40d0dc9-27d9-4f8a-8fd5-a905f74bb6a6`)
**Environment:** production (`bf2ac87f-f183-431e-903b-0392d95f90d0`)
**URL:** https://alkemart-api-production.up.railway.app

CLI context: `/home/amber/Desktop/amber/Alkemart4`

### Build failure: Rollup cannot resolve @radix-ui/* / sonner / tailwindcss-animate

The vendor dashboard (`apps/ghana-vendor`) and admin dashboard (`apps/admin`) use components from `packages/ui` which depend on Radix primitives, sonner, and tailwindcss-animate. These are listed in `packages/ui/package.json` but when Railway builds, bun's workspace hoisting may not make them available to the vendor build's rollup bundler.

**Fix:** Add the missing deps to `apps/backend/package.json` as direct dependencies:
```
@radix-ui/react-checkbox, @radix-ui/react-switch, @radix-ui/react-tabs, sonner, tailwindcss-animate
```

Then run `bun install` from `apps/backend/` and push.

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
