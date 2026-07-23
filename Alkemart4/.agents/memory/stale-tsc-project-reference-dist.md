---
name: Stale tsc project-reference dist
description: Why a typecheck can fail against a workspace lib's exports even though the source looks correct.
---

In this pnpm monorepo, packages like `lib/db` use TypeScript project references
(`composite: true`, `emitDeclarationOnly: true`). Consumers (e.g.
`artifacts/api-server`) typecheck against the referenced project's compiled
`dist/*.d.ts`, not its `src/*.ts`, even though the package's `exports` map
points at `src` for runtime resolution.

**Why:** `dist` is only regenerated when someone runs `tsc -b` (or the build
script) for that lib. If schema/type changes land in `src` without a
rebuild, consumers see missing exports, missing fields, or wrong types in
`tsc --noEmit` even though `git blame` shows the source is current and the
dev server (which imports `src` directly) runs fine.

**How to apply:** Before concluding a cross-package typecheck error is a
real source bug, check whether the referenced lib's `dist` is stale (e.g.
`diff` a `.d.ts` against its `.ts` source, or just rebuild). Fix with
`npx tsc -b lib/db lib/api-zod lib/abilities` (or whichever libs are
referenced) from the workspace root, then re-run the consumer's typecheck.
