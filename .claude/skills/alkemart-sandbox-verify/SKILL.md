---
name: alkemart-sandbox-verify
description: How to prove alkemart features by walking real workflows in the in-memory sandbox (API + storefront/vendor/admin) — use after any API or UI change before reporting done.
---

# Proving features in the alkemart sandbox

The owner wants features proven by walking the real workflow, not just unit tests.
The sandbox is an in-memory API with fixed sandbox-only secrets; it never touches
the real database or real money.

## Start / restart

```bash
cd Alkemart4 && bun apps/api/scripts/sandbox.ts > <scratchpad>/sandbox.log 2>&1   # run in background
```

- API on `http://127.0.0.1:8788`. **Restart after any API change** (Bun doesn't hot-reload it).
  State is wiped on restart.
- `SANDBOX_REAL_PAYSTACK=1` uses the owner's `sk_test_` key from `apps/api/.dev.vars`
  (anything else is refused). Default is a local fake Paystack. Never print keys.
- The log prints `SELLER_SESSION=`, `BUYER_SESSION=`, `ADMIN_SESSION=` JSON lines.
- Seed data: two shops (seller-a "Accra Mart", seller-b "Kumasi Tech"), the Tecno
  Spark offered by both (GH₵1,850 / GH₵1,920), ~14 months of varied past orders and
  monthly payouts (the in-memory clock `checkoutRepo.now` is moved back while seeding).

## Apps (preview configs in `.claude/launch.json`)

| App | Sandbox port | Session key in localStorage |
|---|---|---|
| storefront | 5186 (`sandbox-storefront`) | buyer checks out as guest |
| vendor | 3014 (`sandbox-vendor`) | `alkemart_seller_session` |
| admin | 3013 (`sandbox-admin`) | `alkemart_admin_session` |

Sign a console in by setting the session JSON from the log:
`localStorage.setItem("alkemart_seller_session", '<json>'); location.href="/..."`.
Tokens survive sandbox restarts (fixed secret).

## Walking flows

- Navigate with `location.href='/path?x=y'` via JS when the navigate tool drops the path.
- Prefer `find` / `read_page` / DOM text over screenshots to check exact wording.
- Fill forms with `form_input` refs. Buyer test data only (`buyer@example.com`,
  `0244000000`); never real personal data.
- **Downloads:** don't save files to the owner's machine. Capture the blob instead:
  patch `URL.createObjectURL` and `HTMLAnchorElement.prototype.click`, click the
  button, read `blob.text()` and the `download` name.
- Check `document.documentElement.scrollWidth` at 375px (`resize_window` mobile),
  then reset to desktop.
- Use the API directly (curl with the session token) to confirm what was stored.

## Gotchas seen before

- New TanStack routes need the app's dev server running to regenerate `routeTree.gen.ts`.
  A `business.tsx` plus a `business.x.tsx` nests (needs `<Outlet/>`); use `business.index.tsx`.
- HMR can load a file half-edited ("X is not defined"). Reload before judging.
- Cross-origin downloads need `Access-Control-Expose-Headers: Content-Disposition`
  or the filename is lost.
- The in-memory stores must behave like Postgres: `undefined` means "leave it",
  and seller `metadata` is merged, never replaced.

## Checks to run

```bash
NODE_OPTIONS=--max-old-space-size=3072 npx tsc -b --noEmit   # per app (api: tsc --noEmit -p .)
NODE_OPTIONS=--max-old-space-size=3072 npx eslint src        # vendor/admin/storefront
npx vitest run --maxWorkers=2                                # api: never uncap workers
bun scripts/check-migrations.ts                              # after any migration
```
