---
name: Dashboard Preview Routing
description: How admin and vendor Vite dashboards are wired into the Replit preview proxy for the Alkemart backend.
---

## Setup (as of July 2026)

Two Medusa/Mercur dashboards are registered as proper Replit artifacts so the proxy routes to them.

### Admin Dashboard (`artifacts/admin-panel`)
- **Artifact**: `artifacts/admin-panel`, `previewPath = "/"`, `localPort = 3001`
- **Run command**: `cd /home/runner/workspace/Alkemart4/apps/backend/apps/admin && bun run dev`
- **Vite base**: `/` (dev) — all assets served at root, proxy's `/` artifact captures everything
- **TanStack Router basepath**: `isDev ? "/" : "/dashboard"` — strips nothing in dev, routes match `/login`, `/analytics` etc.
- **Vite proxy** (admin → Medusa): `/admin`, `/auth`, `/vendor`, `/store` → `http://localhost:9000`
  - `/vendor` and `/store` added so vendor API calls routed through the `/` artifact reach Medusa

### Vendor Dashboard (`artifacts/vendor-dashboard`)
- **Artifact**: `artifacts/vendor-dashboard`, `previewPath = "/seller"`, `localPort = 3002`
- **Run command**: `cd /home/runner/workspace/Alkemart4/apps/backend/apps/ghana-vendor && bun run dev`
- **Vite base**: `/seller/` — all assets referenced as `/seller/...` so proxy routes them to port 3002
- **TanStack Router basepath**: `/seller` — strips `/seller` prefix before matching routes
- **Vite proxy** (vendor → Medusa): `/vendor`, `/admin`, `/auth`, `/store` → `http://localhost:9000`
  - These rules only fire for direct port 3002 access; through the proxy they hit the admin Vite instead

## Proxy stripping behaviour (confirmed)

The **external** Replit proxy (`.spock.replit.dev`) strips the artifact prefix before forwarding to the local port. The **internal** proxy (`127.0.0.1:80`) used by the screenshot tool does NOT strip the prefix. This is why screenshot tests pass but the user's browser sees the "did you mean?" error.

- Screenshot tool: `/seller/` → port 3002 receives `/seller/` → Vite base middleware handles normally ✓  
- User's browser: `/seller/` → external proxy strips → port 3002 receives `/` → Vite shows "did you mean /seller/?"

### Root fix: serve index.html directly from a Vite plugin

Simple URL rewrite (`req.url = '/seller/'`) inside `configureServer` is undone by Vite's own base middleware which runs after and strips the prefix back to `/`.

The working fix: `enforce: 'pre'` plugin that reads `index.html`, calls `server.transformIndexHtml('/seller/', raw)`, and writes the response directly for root `/` requests — bypassing Vite's base-check entirely. All subsequent asset requests (`/seller/src/main.tsx` etc.) strip the prefix correctly and Vite serves them normally.

## Key lessons

1. **Artifact ID must be UUID-style** (e.g. `artifacts/admin-panel`), not a legacy path format. Legacy `id = "artifacts/alkemart"` artifacts are not routed by the proxy.
2. **Run command path must be absolute** — managed artifact workflows run from the artifact's own directory, so relative `cd Alkemart4/...` fails. Use `/home/runner/workspace/Alkemart4/...`.
3. **Vendor base must match previewPath prefix** — if previewPath is `/seller`, Vite `base` must be `/seller/` so asset URLs (`/@vite/client`, `/src/main.tsx`) get the same prefix and are routed to the correct port by the proxy. Using `base: '/'` causes asset requests to go to the root artifact (admin) instead.
4. **Root artifact acts as catch-all** — admin at `paths = ["/"]` receives all unmatched paths including vendor API calls (`/vendor/*`, `/store/*`). Must proxy those to Medusa too.
5. **TanStack Router basepath in dev** — admin router uses `isDev ? "/" : "/dashboard"` (from `import.meta.env.DEV`). Vendor router always uses `"/seller"` to match the proxy prefix.
6. **Screenshot tool path is relative to previewPath** — for vendor at `/seller`, pass `path: "/login"` not `path: "/seller/login"` (the tool prepends the previewPath automatically).
