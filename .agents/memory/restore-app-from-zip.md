---
name: Restoring a full app from a zip into a pnpm-workspace repl
description: Pitfalls when restoring a pre-built multi-package app (frontend + api-server + db + lib) from an uploaded zip into an existing pnpm monorepo.
---

## Verify copies actually landed, don't assume
When copying many files from an extracted zip across several packages (schema, routes, openapi spec, frontend src), explicitly diff/verify each critical file after copying — do not assume a `cp` step from an earlier part of the session succeeded. A stub/default `openapi.yaml` silently surviving under a copied directory caused codegen to produce near-empty Zod exports, which only surfaced as confusing `TS2305: has no exported member` errors deep in unrelated route files.

**Why:** the error location (routes importing missing Zod types) was far from the actual root cause (wrong openapi.yaml content), costing a full debugging cycle.

**How to apply:** after bulk-copying source-of-truth files (OpenAPI spec, schema, config), run a quick `wc -l` / `diff` / `grep` sanity check against the source before moving on to codegen/typecheck.

## createArtifact overwrites, so back up first and re-overlay
`createArtifact` for an existing artifact slug resets its scaffold (default App.tsx/wouter/package.json). When restoring a real app onto a freshly (re)created artifact, back up the real source first, let `createArtifact` scaffold, then overlay the real `src/`, `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `components.json`, and `public/` on top — the generated `.replit-artifact/artifact.toml` from `createArtifact` usually already matches what the original app needs and doesn't need hand-editing.

## Don't hand-create workflows for artifacts that already define services in artifact.toml
The platform auto-generates a workflow per artifact service (named like `artifacts/<dir>: <service name>`) from `.replit-artifact/artifact.toml`. Manually calling `configureWorkflow` with a custom name/port for an artifact creates a duplicate/conflicting workflow (port EADDRINUSE) instead of reusing the correct one. Use `listWorkflows()` to find the auto-generated name and `restart_workflow` on that instead of inventing a new workflow.
