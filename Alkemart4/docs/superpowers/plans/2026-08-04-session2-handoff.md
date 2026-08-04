# Session 2 Handoff — Local API Boot Fix + Production E2E Audit

Branch: `e2e-audit-session-2` (pushed to origin). Continue the work from here.
Session 1 was run on `main` (last commit `808939e`). This branch is where the
8-phase plan + handoff doc + the CJS `packages/shared` fix live for a remote
continuation.

---

## Mission

Execute the production-grade E2E audit + fix of the entire Alkemart platform
(Medusa/Mercur backend, admin, vendor, storefront) driven via Chrome DevTools
MCP on an isolated local full-stack — no seeding, no generic accounts/products —
ending with Phase 8 deploy to Railway.

Canonical plan: `docs/superpowers/plans/2026-08-03-production-e2e-audit-and-hardening.md` (8 phases).

Real admin: `isaiahamber5@gmail.com` / `alkemart25ventSo`. 12 real products in `spec/public`. First workflow = vendor onboarding.

---

## THE core bug (still UNSOLVED — this is the blocker)

**Two overlapping bun workspaces → split `@medusajs/*` resolution → `create-payment-sessions` workflow collision → API cannot boot locally.**

### Root cause (fully diagnosed)

- Repo has TWO bun workspace roots that overlap:
  - **Outer root** `Alkemart4/package.json` (name `workspace`) declares
    `workspaces: ["apps/backend", "apps/backend/apps/admin", "apps/backend/apps/ghana-vendor", "packages/shared", "packages/ui", "scripts", "apps/storefront"]` and owns `Alkemart4/bun.lock`.
  - **Backend** `apps/backend/package.json` (name `backend`) declares its OWN
    `workspaces: ["packages/*", "apps/*"]` and owns `apps/backend/bun.lock`.
- Production boots because Railway sets **Root directory: `Alkemart4/apps/backend`**,
  so bun installs with `apps/backend` as the workspace root → `packages/api` IS a
  workspace member → it gets its `@alkemart/shared` symlink AND the full
  `@medusajs/*` tree (incl. `core-flows`, `workflows-sdk`) in ONE store.
- Locally, installing from the OUTER root treats `apps/backend` as a single opaque
  workspace package. Result: `apps/backend/packages/api` is NOT a workspace member,
  so bun never creates `node_modules/@alkemart/shared` and never hoists
  `@medusajs/core-flows` / `workflows-sdk` / `orchestration` into the backend tree.
- Runtime split (proven via `require.resolve` from `apps/backend/packages/api`):
  `@medusajs/medusa` + `framework` resolved to store `17fd93965e5ab097`/`6fe4cce538fc6409`,
  while `@medusajs/core-flows` + `workflows-sdk` + `orchestration` were FAILING (pre-reinstall) or
  resolving to stale real dirs at the outer root. Two copies of `core-flows` =
  two `workflows-sdk` registries = "step definition already exists: create-payment-sessions".
- **After** a clean single-tree `bun install` at the outer root (3496 pkgs), the
  collision itself was GONE (progress!), but route registration now fails with a
  NEW error: `Error: Cannot read properties of undefined (reading 'def')` during
  API route registration. AND direct imports of `@alkemart/shared/ghana` and
  `@medusajs/core-flows` fail from `packages/api` because those workspace deps were
  never created for the API package under the outer-root install.

### The fix direction (half-executed, aborted by user)

To reproduce production exactly, install from **`apps/backend` as the bun root**:
```
cd apps/backend
# ensure outer lock does NOT hijack bun's workspace-root detection
# (move Alkemart4/bun.lock aside, or delete apps/backend's own bun.lock is WRONG —
#  backend's lock is what makes packages/api a member)
bun install
```
This was attempted: `mv Alkemart4/bun.lock /tmp/...` then `bun install` in
`apps/backend` — **user aborted** mid-install. State at abort: outer lock had been
moved to `/tmp/opencode/outer-bun.lock.moved2`; `apps/backend/node_modules` was
`rm -rf`'d. The outer lock was since RESTORED to `Alkemart4/bun.lock` (reverted to
HEAD content, so `git checkout HEAD -- Alkemart4/bun.lock` was applied).

**IMPORTANT RESTORED STATE:**
- `Alkemart4/bun.lock` = HEAD content (clean, reverted the 51-line tsx/esbuild pollution).
- `apps/backend/node_modules` currently = leftover from the aborted backend-root install
  (may be partial). **Run `rm -rf apps/backend/node_modules` before reinstalling.**
- Backups in `/tmp/opencode/`: `outer-bun.lock.bak`, `outer-bun.lock.moved2` (both 755275 bytes),
  `backend-bun.lock.bak` (664152 bytes).

### Verified facts about the layout (don't redo this research)

- Backend `node_modules/@medusajs/*` are SYMLINKS into the OUTER store
  (`../../../../node_modules/.bun/...`), 10 pkgs only (admin-sdk, admin-shared, cli,
  dashboard, draft-order, framework, icons, medusa, test-utils, ui).
- The outer `.bun` store (`Alkemart4/node_modules/.bun`) has the FULL set:
  `@medusajs+core-flows@2.17.2+b1c807545e5294de`,
  `@medusajs+workflows-sdk@2.17.2+7ff252c65a087786`,
  medusa in multiple hashes (`1269ac17c900e338`, `17fd93965e5ab097`, `8db536852d694ac7`, …).
- `@medusajs/medusa` store entry `17fd93965e5ab097` has 54 nested `@medusajs/*` deps
  (this is why medusa's OWN core-flows is a separate copy → the collision).
- `apps/backend/packages/shared` (name `@alkemart/shared`) and outer `packages/shared`
  are byte-identical copies (`diff -rq` clean). Git history: `2de2e4c` added
  `@alkemart/shared` to backend workspace + refreshed backend bun.lock.
- `apps/backend/packages/ui` and outer `packages/ui` similarly duplicated.
- `apps/storefront` + `apps/backend/apps/admin` (`@acme/admin`) + `apps/backend/apps/ghana-vendor`
  (`@alkemart/ghana-vendor`) are workspace members in the OUTER lock. Admin/vendor use
  `@workspace/ui` (outer `packages/ui`).
- Backend lock `apps/backend/bun.lock` (4666 lines) is the one production uses.
- `.bun` store entries live under `Alkemart4/node_modules/.bun/` (bun global cache is `~/.bun/install/cache/`, which has the tarballs — network needed to fetch anything not cached; network confirmed UP).

---

## State of the local infra (Phase 0 — done)

- Isolated local stack under `/home/amber/.lokalkemart`:
  - Postgres 16.14.0 on `127.0.0.1:5433` (DB `alkemart`, owner `alkemart`)
  - Meilisearch 1.52.0 on `127.0.0.1:7700`
  - Valkey/Redis on `127.0.0.1:6379`
  - Node 20.20.2 in `$B/deps/node/bin` (`$B=/home/amber/.lokalkemart`)
- API `.env` isolated: `apps/backend/packages/api/.env` (local DB URL, `DATABASE_NO_SSL=true`).
  Prod backup: `.env.prod-neon-backup`.
- `medusa db:migrate` ran clean.
- Boot command (from `apps/backend/packages/api`):
  `PATH=$B/deps/node/bin:$PATH NODE_OPTIONS=--import=tsx <cli> develop`
  where `<cli>` = `../../node_modules/.bin/medusa` (path exists).
- Logs: `/home/amber/.lokalkemart/logs/api.log`.
- **CRITICAL gotcha:** `pkill -f 'medusa develop'` hangs the shell tool — use `kill <pid>`.
  `pgrep -a medusa` is safe. Also avoid `pgrep -f medusa` in a command that also
  contains the word `medusa` (it kills your own shell).

### Dev URLs
admin `:9000/dashboard`, vendor `:9000/seller`; vite admin 3001, vendor 3002 (`base: '/seller/'`), storefront 5175.

---

## What has NOT changed / pending

- `apps/backend/packages/api/package.json:54` has `"@alkemart/shared": "workspace:*"` — keep.
- Root `packages/shared/package.json` "type": "module" REMOVED (this is the `fe116c6`
  CJS invariant; the local working-tree change `M packages/shared/package.json` must be committed).
- `node_modules/ajv-draft-04/node_modules/ajv` symlink fix is GITIGNORED (node_modules) — will be
  regenerated on fresh install; if the CLI errors on `ajv/dist/core` again, re-apply:
  `ln -sfn ../../.bun/ajv@8.13.0/node_modules/ajv node_modules/ajv-draft-04/node_modules/ajv`.
- Storefront `.env` still has EMPTY `VITE_MEDUSA_PUBLISHABLE_KEY`, `VITE_MEDUSA_REGION_ID`,
  `VITE_MEDUSA_SALES_CHANNEL_ID`. Paystack keys empty locally.

---

## NEXT MOVE (Session 2 must do this first)

1. `cd /home/amber/Desktop/amber/Alkemart4/Alkemart4/apps/backend`
2. `rm -rf node_modules` (clear leftover from the aborted backend-root install)
3. Move the outer lock aside so bun treats `apps/backend` as the workspace root:
   `mv ../bun.lock /tmp/opencode/outer-bun.lock.session3`
4. `bun install` (backend as root → packages/api becomes a member, `@alkemart/shared`
   symlink + full `@medusajs/*` hoisted into one backend store). This mirrors production.
5. Restore outer lock: `mv /tmp/opencode/outer-bun.lock.session3 ../bun.lock`
   (only if it didn't get modified; check `git status`).
6. Verify resolution from `apps/backend/packages/api`:
   `@medusajs/medusa`, `@medusajs/core-flows`, `@medusajs/workflows-sdk`,
   `@medusajs/framework`, `@medusajs/orchestration`, `@alkemart/shared` ALL resolve
   and `core-flows`/`medusa` come from the SAME store hash.
7. Boot API: `PATH=/home/amber/.lokalkemart/deps/node/bin:$PATH NODE_OPTIONS=--import=tsx ../../node_modules/.bin/medusa develop`
   from `apps/backend/packages/api`. Wait for "Server is ready on port: 9000".
   New error (`reading 'def'`) should be gone if workspace deps now resolve; if not,
   investigate the `.def` read (Zod schemas in custom routes / mercur plugin).
8. Once API is up: populate storefront `.env` (publishable key, region id, sales channel id).
9. Phase 1 via Chrome DevTools MCP: create admin `isaiahamber5@gmail.com`, vendor, customer
   through UI only.

## Likely "reading 'def'" cause (pre-verified lead)
The `.def` accesses seen are all Zod internals (`schema.def`, `_zod.def`) in
dashboard/draft-order bundles. The crash is during API route registration at
`medusa/src/loaders/api.ts:72` → `new http_1.ApiLoader(...).load()` →
`routesLoader.scanDir` → `dynamicImport` of project route files. The likely trigger is a
project route file (e.g. `admin/orders/route.ts`, `store/ghana-checkout/route.ts`) whose
imported workspace pkg (`@alkemart/shared` or `@medusajs/core-flows`) failed to resolve,
returning a broken module graph. Fixing workspace membership (step 2–6 above) likely
resolves it. If it persists, bisect by importing each `route.ts` under tsx:
```
cd apps/backend/packages/api
for f in $(find src/api -name route.ts); do NODE_OPTIONS=--import=tsx node -e "import('./$f').catch(e=>{console.log('FAIL',$f,e.message)})"; done
```

---

## Working tree / commit contents (this branch)

Included in this commit:
- `docs/superpowers/plans/2026-08-04-session2-handoff.md` (this file)
- `docs/superpowers/plans/2026-08-03-production-e2e-audit-and-hardening.md` (the 8-phase plan)
- `packages/shared/package.json` (drop `"type": "module"` — CJS invariant)
- Pre-existing uncommitted storefront files (`AppFooter.tsx`, `__root.tsx`) — left as-is from before
- `Alkemart4/vercel.json` — stray top-level file

NOT included (excluded): `vercel.json.bak` (stray backup at repo root),
`Alkemart4/bun.lock` pollution (reverted to HEAD).

## Railway reference (for Phase 8)
- Project `comfortable-success` (`8e3b8293-9aee-48f9-a999-aa69ded1c1e9`),
  service `alkemart-api` (`d40d0dc9-27d9-4f8a-8fd5-a905f74bb6a6`),
  env `production` (`bf2ac87f-f183-431e-903b-0392d95f90d0`),
  URL https://alkemart-api-production.up.railway.app
- Root directory `Alkemart4/apps/backend`, builder RAILPACK, 25 vars.
- Last green deploy: commit `fe116c6` ("fix(api): drop type module from @alkemart/shared").
- Deploy gate: confirm `Server is ready on port: 9000` in logs.
