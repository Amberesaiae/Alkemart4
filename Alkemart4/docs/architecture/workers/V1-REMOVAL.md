# Task: delete the retired v1 apps

**Owner decision (2026-09-27): delete all of v1.** The v2 apps are the live
UIs (`scripts/deploy-pages.sh` already deploys only v2). This is a handoff for
an agent to do the removal. Nothing has been deleted yet. Work on a branch,
not `main`, and open one PR.

## What "v1" is

| Path | Package name | What it was | Tracked files |
|---|---|---|---|
| `Alkemart4/apps/storefront` | `@workspace/storefront` | old buyer storefront (replaced by `apps/storefront-v2`) | 653 |
| `Alkemart4/apps/backend` | `backend` | old Medusa/Mercur workspace root holding the three below (1.3 GB on disk incl. node_modules) | 514 in total |
| `Alkemart4/apps/backend/apps/admin` | `@acme/admin` | old admin (replaced by `apps/admin-v2`) | 193 |
| `Alkemart4/apps/backend/apps/ghana-vendor` | `@alkemart/ghana-vendor` | old seller app (replaced by `apps/vendor-v2`) | 39 |
| `Alkemart4/apps/backend/packages/api` | `@acme/api` | old Medusa API (replaced by `apps/api`, Workers) | 264 |
| `Alkemart4/packages/ui` | `@workspace/ui` | v1 component kit (v2 uses `packages/console-ui` and storefront-v2's own `components/ui`) | 44 |

1,211 tracked files in total (`git ls-files apps/storefront apps/backend packages/ui | wc -l`).

**Keep:** `apps/api`, `apps/storefront-v2`, `apps/vendor-v2`, `apps/admin-v2`,
and every package except `packages/ui`.

## Checked before writing this (2026-09-27)

- **No live code imports v1.** No v2 app, `apps/api` or remaining package
  lists a v1 package as a dependency, and no source file imports from a v1
  path. The only `@workspace/ui` dependents are the v1 apps themselves.
- **Demo product photos are already in v2** (`apps/storefront-v2/public/images/products/demo`, 30 files).
  `scripts/seed/demo-market.ts` only *mentions* the v1 folder in a comment.
- **Already repointed at v2** (done in this session, keep them):
  `scripts/dev-workers.sh` (`bun run dev`), and root `package.json`
  `dev:storefront`, `dev:vendor`, `dev:admin`, `test:storefront`. Before this,
  `bun run dev` started the three v1 UIs and CI's "Storefront tests" step
  (`bun run test:storefront`) tested v1, not v2.
- **Uncommitted v1 edits exist** (`apps/storefront/src/...`, plus untracked
  `HomeHero.tsx`, `HomeTrustStrip.tsx`). The owner is fine losing them; delete
  them with the rest.

## Steps

1. **Delete the folders:** `git rm -r Alkemart4/apps/storefront Alkemart4/apps/backend Alkemart4/packages/ui`,
   then `rm -rf` the same paths to drop untracked files and `node_modules`.
2. **Root `Alkemart4/package.json` `workspaces`:** remove `apps/backend`,
   `apps/backend/packages/api`, `apps/backend/apps/admin`,
   `apps/backend/apps/ghana-vendor`, `apps/storefront`, `packages/ui`.
   Keep the `dev:*-v2` scripts or fold them into `dev:*` (they're duplicates now).
3. **Stale `packages/ui` mappings in the v2 consoles.** These don't resolve to anything
   (`packages/ui/src/components` doesn't exist, so TypeScript falls back to the
   real `@workspace/console-ui` package), but they must go:
   - `apps/vendor-v2/tsconfig.json`, `apps/vendor-v2/tsconfig.app.json`,
     `apps/admin-v2/tsconfig.json`, `apps/admin-v2/tsconfig.app.json`: delete the
     `"@workspace/console-ui/*": ["../../packages/ui/src/*"]` path entry.
   - `apps/vendor-v2/components.json`, `apps/admin-v2/components.json`:
     point `tailwind.css` at `packages/console-ui`'s stylesheet (check where
     `@workspace/console-ui` keeps its globals) instead of `packages/ui`.
4. **Scripts that only served v1** — delete:
   `scripts/deploy-storefront.sh`, `scripts/lab-bootstrap-marketplace.sh`,
   `scripts/src/backend-migrate.ts`, `scripts/src/backend-sync.ts`,
   `scripts/src/neon-connect-backend.ts` (`scripts/package.json` has no entries for them).
   **Update:** `scripts/dev-setup.sh` (drops the `apps/backend/packages/api/.env`
   and `apps/storefront/.env` copies; add v2 `.env` templates if they exist),
   `scripts/postman/run-newman.sh` (reads `apps/storefront/.env`),
   the comment in `scripts/seed/demo-market.ts`, and the note in
   `scripts/deploy-pages.sh` (can just say v2 is the only UI).
5. **Lockfiles:** run `bun install` in `Alkemart4/` and commit the updated
   `Alkemart4/bun.lock`. CI uses `bun install --frozen-lockfile`, so a stale
   lockfile fails CI. Leave `../pnpm-lock.yaml` (untracked, repo root) alone
   unless the owner says otherwise.
6. **Docs.** `docs/architecture/workers/LOCAL-DEV.md` is the important one:
   ports are now storefront **5176**, vendor **3004**, admin **3003** (not
   5175/3002/3001), and env files live in the v2 apps. Then remove or rewrite
   v1 references in: `workers/README.md`, `AGENT-PLAYBOOK.md`, `HANDOFF.md`,
   `LIFECYCLE-BUYER.md`, `LIFECYCLE-VENDOR.md`, `CONSOLE-REDESIGN.md`,
   `AGNOSTIC-APPROACH.md`, `docs/ops/runbook.md`, `docs/DEMO-ACCOUNTS.md`,
   `docs/architecture/decisions/event-dictionary.md`. Research/strategy/plan
   docs (`docs/research`, `docs/strategy`, `docs/superpowers`) are history —
   leave them. Find the rest with:
   `grep -rlE "apps/storefront[^-]|apps/backend|packages/ui" Alkemart4/docs | grep -v archive`.
7. **Nothing else to change:** `.claude/launch.json` has only v2 entries;
   CI (`.github/workflows/ci.yml`) builds via `bun run build` (v2 only) and
   tests via the root scripts fixed above.

## Done when

All of these pass from `Alkemart4/`:

```bash
bun install
NODE_OPTIONS=--max-old-space-size=3072 bun run typecheck
bun run build
bun run test            # api + domain + storefront-v2
bun run check:migrations && bun run check:api-client
(cd apps/vendor-v2 && npx eslint src) && (cd apps/admin-v2 && npx eslint src) && (cd apps/storefront-v2 && npx eslint src)
grep -rnE "apps/storefront[^-]|apps/backend|packages/ui/" --include='*.ts' --include='*.tsx' --include='*.json' --include='*.sh' apps packages scripts | grep -v node_modules   # expect nothing
```

Then `bun run dev` starts the API + three v2 apps, and each loads in a
browser (the sandbox configs in `.claude/launch.json` work too).
