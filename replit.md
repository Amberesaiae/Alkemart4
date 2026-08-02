# Alkemart4

A Medusa v2 + Mercur marketplace platform for Ghana — buyers, vendors, and admin in one monorepo.

## Project layout

```
Alkemart4/
├── apps/
│   ├── backend/          # Medusa v2 + Mercur API (Node 22 / Bun), deployed on Railway
│   │   ├── apps/
│   │   │   ├── admin/        # Admin dashboard (React/Vite, port 9000)
│   │   │   └── ghana-vendor/ # Vendor dashboard (React/Vite, port 3002)
│   │   └── packages/
│   │       ├── api/          # Medusa config, modules, routes, subscribers
│   │       └── ui/           # Shared UI component library (@workspace/ui)
│   └── storefront/       # Buyer storefront PWA (Vite + React + TanStack Router, port 5175)
├── archive/              # Legacy/archived apps (not in use)
└── docs/                 # Architecture docs, deployment guide, ops runbooks
```

## Production stack

| Service | Platform |
|---|---|
| API | Railway (`https://alkemart-api-production.up.railway.app`) |
| Database | Neon PostgreSQL |
| Cache / queues | Railway Redis |
| Search | Railway Meilisearch |
| Storefront | Vercel |
| Object storage | Tigris / Backblaze B2 |
| Payments | Paystack (Ghana cards + MoMo) |
| SMS / WhatsApp | Africa's Talking |

## Package manager

Bun workspaces. Run `bun install` from `Alkemart4/` (root) or from `Alkemart4/apps/backend/` depending on context. Turbo is used for build orchestration inside the backend monorepo.

## Key files

- `Alkemart4/AGENTS.md` — agent conventions, known quirks, UI patterns
- `Alkemart4/DEPLOYMENT.md` — full deployment guide for Railway / Neon / Vercel
- `Alkemart4/docs/` — architecture diagrams, ops runbooks, production checklists
- `Alkemart4/apps/backend/packages/api/src/medusa-config.ts` — Medusa configuration
- `Alkemart4/apps/storefront/src/` — storefront routes and components

## User preferences

- Code changes only; no need to run the app on Replit
- Production backend is already live on Railway; storefront on Vercel
