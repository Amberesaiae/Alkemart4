# Production Readiness Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Alkemart4 production-ready by fixing security, testing, CI/CD, deployment, error handling, and monitoring gaps.

**Architecture:** Operate on the existing MedusaJS v2 + Mercur + React 19 SPA stack. No framework migration. Fix operational infrastructure around the existing codebase.

**Tech Stack:** React 19, Vite 7, TanStack Router, MedusaJS 2.17.2, Mercur 2.2.0, Neon PostgreSQL, GitHub Actions, Sentry, Vitest.

---

## Auth Library Recommendation

### BetterAuth vs WorkOS vs Oso

| Dimension | BetterAuth | WorkOS | Oso |
|-----------|-----------|--------|-----|
| **Type** | Auth framework (authN + authZ) | Auth provider (managed service) | Authorization library (authZ only) |
| **Self-hosted** | Yes (MIT, your DB) | No (cloud-only) | Yes (Apache-2.0) |
| **Pricing** | Free | Free <=1M MAUs; SSO $125/connection | Free (Oso Cloud has paid tier) |
| **React SDK** | Yes (`useSession()`) | Yes (`useAuth()`) | No (backend-only) |
| **MedusaJS compat** | No official plugin | No official plugin | No official plugin |
| **Key strength** | Full-stack auth, social login, MFA, orgs, RBAC | Enterprise SSO, SCIM, directory sync | Fine-grained Polar policy language |

### Recommendation: Keep Medusa native auth

**Why not BetterAuth:**
- MedusaJS v2 already has a complete auth module (emailpass, session + JWT, customer/member/user actors)
- BetterAuth would require ripping out Medusa's auth layer, reworking the SDK integration, and maintaining a separate user table
- The "three doors" architecture (buyer/seller/admin) maps directly to Medusa's actor types (customer/member/user) -- this is exactly what Medusa is designed for
- BetterAuth's org/multi-tenancy features overlap with Mercur's vendor model -- two overlapping abstractions

**Why not WorkOS:**
- Alkemart is B2C (Ghana marketplace), not B2B SaaS -- enterprise SSO/SCIM is not a buyer need
- Cloud-only vendor lock-in for auth is risky for a Ghana-first product
- Free tier is generous but the architecture mismatch is fundamental

**Why not Oso:**
- Authorization-only -- you still need an auth provider (Medusa already is one)
- The existing CASL abilities pattern (archived) and Medusa's route-level `authenticate()` middleware already cover current RBAC needs
- Oso's Polar DSL is powerful but overkill for buyer/vendor/admin with row-level vendor isolation

**What to do instead:**
1. Keep Medusa's native auth (it's working)
2. Add proper route-level auth guards in TanStack Router (Task 4)
3. Rebuild the customer roles module (currently roles are stuffed into `customer.metadata.roles` JSON -- fragile)
4. Add social login via Medusa's auth module when needed (Google OAuth for Ghana buyers)

---

## Global Constraints

- Bun 1.3.14 as package manager
- MedusaJS 2.17.2, Mercur 2.2.0
- React 19.1.0, Vite 7.3.2
- Neon PostgreSQL (serverless)
- All money in integer pesewas (ADR-002)
- No hardcoded URLs, keys, roles, stock values (CFG-0)
- TypeScript strict mode in storefront and backend

---

## Phase 1: Security (CRITICAL -- do first)

### Task 1.1: Rotate compromised credentials

**Files:**
- Modify: `.env` (root)
- Modify: `apps/backend/packages/api/.env`

**Interfaces:**
- Consumes: current Neon DB credentials (to be rotated)
- Produces: new Neon credentials, updated `.env` files

- [ ] **Step 1:** Log into Neon dashboard and reset the database password for `neondb_owner` on `alkemart_marketplace`
- [ ] **Step 2:** Copy the new connection string from Neon dashboard
- [ ] **Step 3:** Update root `.env` with new `DATABASE_URL`
- [ ] **Step 4:** Update `apps/backend/packages/api/.env` with new `DATABASE_URL`
- [ ] **Step 5:** Verify connection: `psql "$DATABASE_URL" -c "SELECT 1"`
- [ ] **Step 6:** Generate strong secrets:

```bash
JWT_SECRET=$(openssl rand -hex 32)
COOKIE_SECRET=$(openssl rand -hex 32)
echo "JWT_SECRET=$JWT_SECRET"
echo "COOKIE_SECRET=$COOKIE_SECRET"
```

- [ ] **Step 7:** Update `apps/backend/packages/api/.env` with new `JWT_SECRET` and `COOKIE_SECRET`
- [ ] **Step 8:** Verify Medusa boots: `cd apps/backend/packages/api && bun run dev`
- [ ] **Step 9:** Commit updated `.env.template` files (NOT the actual `.env` files)

### Task 1.2: Remove root `.env` from git tracking

**Files:**
- Modify: `.gitignore`
- Command: `git rm --cached .env`

- [ ] **Step 1:** Verify `.env` is in `.gitignore` (it already is)
- [ ] **Step 2:** Remove from git tracking:

```bash
git rm --cached .env
```

- [ ] **Step 3:** Verify: `git ls-files .env` returns empty
- [ ] **Step 4:** Add `.env.local` to `.gitignore`
- [ ] **Step 5:** Commit: `chore: remove tracked .env from git index`

### Task 1.3: Fail-safe env validation on boot

**Files:**
- Create: `apps/backend/packages/api/src/lib/env.ts`
- Modify: `apps/backend/packages/api/medusa-config.ts`

- [ ] **Step 1:** Create env validation module:

```typescript
// apps/backend/packages/api/src/lib/env.ts
import { z } from "zod"

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  COOKIE_SECRET: z.string().min(32),
  STORE_CORS: z.string().min(1),
  ADMIN_CORS: z.string().min(1),
  AUTH_CORS: z.string().min(1),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_PUBLIC_KEY: z.string().optional(),
  DEFAULT_CURRENCY: z.string().default("ghs"),
  DEFAULT_COUNTRY_CODE: z.string().default("gh"),
})

export type AppEnv = z.infer<typeof EnvSchema>

export function loadAppEnv(raw: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = EnvSchema.safeParse(raw)
  if (!parsed.success) {
    console.error("Environment validation failed:", parsed.error.flatten().fieldErrors)
    throw new Error("Invalid environment configuration")
  }
  if (parsed.data.NODE_ENV === "production") {
    if (parsed.data.JWT_SECRET.includes("supersecret") || parsed.data.COOKIE_SECRET.includes("supersecret")) {
      throw new Error("Refusing to start with default secrets in production")
    }
    if (!parsed.data.PAYSTACK_SECRET_KEY) {
      throw new Error("PAYSTACK_SECRET_KEY required in production")
    }
  }
  return parsed.data
}
```

- [ ] **Step 2:** Wire into `medusa-config.ts` -- import `loadAppEnv()` and use validated values
- [ ] **Step 3:** Remove hardcoded `"supersecret"` fallbacks from `medusa-config.ts` lines 85-86
- [ ] **Step 4:** Test: set `JWT_SECRET=supersecret` and `NODE_ENV=production` -- should refuse to start
- [ ] **Step 5:** Commit: `fix(backend): validate env on boot, reject default secrets in production`

---

## Phase 2: Error Boundaries (Prevent white-screen crashes)

### Task 2.1: Add React error boundaries to storefront

**Files:**
- Create: `apps/storefront/src/components/error-boundary.tsx`
- Modify: `apps/storefront/src/routes/__root.tsx`

- [ ] **Step 1:** Create error boundary component:

```tsx
// apps/storefront/src/components/error-boundary.tsx
import { Component, type ReactNode } from "react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex min-h-screen items-center justify-center p-8">
            <div className="text-center">
              <h2 className="text-lg font-semibold">Something went wrong</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {this.state.error?.message ?? "An unexpected error occurred"}
              </p>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
              >
                Try again
              </button>
            </div>
          </div>
        )
      )
    }
    return this.props.children
  }
}
```

- [ ] **Step 2:** Wrap app in `__root.tsx`:

```tsx
import { ErrorBoundary } from "@/components/error-boundary"

// In the root component's render:
<ErrorBoundary>
  <RouterProvider router={router} />
</ErrorBoundary>
```

- [ ] **Step 3:** Add route-level error boundaries for critical routes (checkout, account, cart)
- [ ] **Step 4:** Verify: throw an error in a component -- should show boundary UI, not white screen
- [ ] **Step 5:** Commit: `fix(storefront): add error boundaries to prevent white-screen crashes`

### Task 2.2: Add loading states for async routes

**Files:**
- Modify: `apps/storefront/src/routes/account.tsx`
- Modify: `apps/storefront/src/routes/orders.tsx`
- Modify: `apps/storefront/src/routes/checkout.tsx`

- [ ] **Step 1:** Add `pendingComponent` exports to each protected route:

```tsx
import { Skeleton } from "@/components/ui/skeleton"

export const PendingComponent = () => (
  <div className="container mx-auto px-4 py-8">
    <Skeleton className="h-8 w-48 mb-4" />
    <Skeleton className="h-4 w-96 mb-2" />
    <Skeleton className="h-4 w-64" />
  </div>
)
```

- [ ] **Step 2:** Test: navigate to `/account` -- should show skeleton during load, not blank
- [ ] **Step 3:** Commit: `fix(storefront): add loading states for async route transitions`

---

## Phase 3: Testing Foundation

### Task 3.1: Set up Vitest for storefront

**Files:**
- Modify: `apps/storefront/package.json`
- Create: `apps/storefront/vitest.config.ts`
- Create: `apps/storefront/src/lib/__tests__/auth.test.ts`

- [ ] **Step 1:** Install Vitest and testing library:

```bash
cd apps/storefront
bun add -d vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2:** Create Vitest config:

```typescript
// apps/storefront/vitest.config.ts
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
})
```

- [ ] **Step 3:** Add test script to `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 4:** Write first test -- auth utility:

```typescript
// apps/storefront/src/lib/__tests__/auth.test.ts
import { describe, it, expect } from "vitest"
import { getBuyerAccess } from "../auth"

describe("getBuyerAccess", () => {
  it("returns guest when no session", () => {
    const result = getBuyerAccess(null)
    expect(result).toBe("guest")
  })

  it("returns customer when session exists", () => {
    const result = getBuyerAccess({ id: "cus_123", email: "test@example.com" })
    expect(result).toBe("customer")
  })
})
```

- [ ] **Step 5:** Run test: `bun run test` -- should pass
- [ ] **Step 6:** Commit: `test(storefront): add Vitest config and auth unit tests`

### Task 3.2: Add critical path tests for backend

**Files:**
- Create: `apps/backend/packages/api/src/lib/__tests__/env.unit.spec.ts`
- Create: `apps/backend/packages/api/integration-tests/http/catalog.spec.ts`

- [ ] **Step 1:** Write env validation test:

```typescript
// apps/backend/packages/api/src/lib/__tests__/env.unit.spec.ts
import { loadAppEnv } from "../env"

describe("loadAppEnv", () => {
  const baseEnv = {
    DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    REDIS_URL: "redis://localhost:6379",
    JWT_SECRET: "a".repeat(32),
    COOKIE_SECRET: "b".repeat(32),
    STORE_CORS: "http://localhost:5175",
    ADMIN_CORS: "http://localhost:7000",
    AUTH_CORS: "http://localhost:5175",
  }

  it("loads with valid env", () => {
    const env = loadAppEnv({ ...baseEnv, NODE_ENV: "development" })
    expect(env.NODE_ENV).toBe("development")
    expect(env.DEFAULT_CURRENCY).toBe("ghs")
  })

  it("rejects default JWT secret in production", () => {
    expect(() =>
      loadAppEnv({ ...baseEnv, NODE_ENV: "production", JWT_SECRET: "supersecret" })
    ).toThrow("default secrets")
  })

  it("rejects missing DATABASE_URL", () => {
    const { DATABASE_URL, ...rest } = baseEnv
    expect(() => loadAppEnv(rest)).toThrow()
  })

  it("rejects short JWT_SECRET", () => {
    expect(() =>
      loadAppEnv({ ...baseEnv, JWT_SECRET: "short" })
    ).toThrow()
  })
})
```

- [ ] **Step 2:** Write catalog integration test:

```typescript
// apps/backend/packages/api/integration-tests/http/catalog.spec.ts
import { medusaIntegrationTestRunner } from "@medusajs/medusa/test-utils"

describe("Catalog API", () => {
  const suite = medusaIntegrationTestRunner({ dbName: "catalog-test" })

  beforeAll(async () => {
    await suite.start()
  })

  afterAll(async () => {
    await suite.teardown()
  })

  it("lists products with calculated prices", async () => {
    const response = await suite.api.get("/store/products?limit=1")
    expect(response.status).toBe(200)
    expect(response.body.products).toBeDefined()
    if (response.body.products.length > 0) {
      const product = response.body.products[0]
      expect(product.variants).toBeDefined()
      expect(product.variants.length).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 3:** Run tests: `cd apps/backend/packages/api && bun run test:unit`
- [ ] **Step 4:** Commit: `test(backend): add env validation and catalog integration tests`

---

## Phase 4: Auth Route Guards

### Task 4.1: Add TanStack Router auth guards

**Files:**
- Create: `apps/storefront/src/lib/route-guards.ts`
- Modify: `apps/storefront/src/routes/account.tsx`
- Modify: `apps/storefront/src/routes/orders.tsx`
- Modify: `apps/storefront/src/routes/checkout.tsx`

- [ ] **Step 1:** Create auth guard utility:

```typescript
// apps/storefront/src/lib/route-guards.ts
import { redirect } from "@tanstack/react-router"
import { getSessionCustomer } from "./auth"

export async function requireAuth() {
  const customer = await getSessionCustomer()
  if (!customer) {
    throw redirect({ to: "/signin", search: { redirect: window.location.pathname } })
  }
  return customer
}

export async function requireGuest() {
  const customer = await getSessionCustomer()
  if (customer) {
    throw redirect({ to: "/account" })
  }
}
```

- [ ] **Step 2:** Add `beforeLoad` to protected routes:

```tsx
// In account.tsx
import { requireAuth } from "@/lib/route-guards"

export const Route = createFileRoute("/account")({
  beforeLoad: async () => {
    const customer = await requireAuth()
    return { customer }
  },
  // ... component uses Route.useLoaderData() for customer
})
```

- [ ] **Step 3:** Apply to `/orders`, `/checkout`, `/addresses`
- [ ] **Step 4:** Apply `requireGuest` to `/signin` (redirect logged-in users to `/account`)
- [ ] **Step 5:** Test: navigate to `/account` while logged out -- should redirect to `/signin?redirect=/account`
- [ ] **Step 6:** Test: navigate to `/signin` while logged in -- should redirect to `/account`
- [ ] **Step 7:** Commit: `fix(storefront): add route-level auth guards with redirects`

---

## Phase 5: CI/CD Pipeline

### Task 5.1: GitHub Actions -- typecheck + lint + test

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1:** Create CI workflow:

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  storefront:
    name: Storefront
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/storefront
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: "1.3.14"
      - run: bun install --frozen-lockfile
      - run: bun run typecheck
      - run: bun run test
      - run: bun run build

  backend:
    name: Backend
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: alkemart_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
    defaults:
      run:
        working-directory: apps/backend/packages/api
    env:
      DATABASE_URL: postgresql://test:test@localhost:5432/alkemart_test
      REDIS_URL: redis://localhost:6379
      JWT_SECRET: test-jwt-secret-that-is-at-least-32-chars-long
      COOKIE_SECRET: test-cookie-secret-that-is-at-least-32-chars
      STORE_CORS: http://localhost:5175
      ADMIN_CORS: http://localhost:7000
      AUTH_CORS: http://localhost:5175
      NODE_ENV: test
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: "1.3.14"
      - run: bun install --frozen-lockfile
        working-directory: .
      - run: bun run build
      - run: bun run test:unit
      - run: bun run test:integration:modules
```

- [ ] **Step 2:** Verify workflow: push to branch and check Actions tab
- [ ] **Step 3:** Commit: `ci: add GitHub Actions for storefront and backend`

### Task 5.2: Add pre-commit hooks

**Files:**
- Modify: `package.json`
- Create: `.husky/pre-commit`

- [ ] **Step 1:** Install husky and lint-staged:

```bash
bun add -d husky lint-staged
```

- [ ] **Step 2:** Configure lint-staged in `package.json`:

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["bun run typecheck"],
    "*.{json,yaml,yml}": ["prettier --write"]
  }
}
```

- [ ] **Step 3:** Initialize husky: `bunx husky init`
- [ ] **Step 4:** Add prepare script: `"prepare": "husky"`
- [ ] **Step 5:** Commit: `chore: add husky and lint-staged for pre-commit checks`

---

## Phase 6: Deployment Configuration

### Task 6.1: Storefront -- Cloudflare Pages deploy

**Files:**
- Modify: `apps/storefront/package.json`
- Create: `apps/storefront/wrangler.toml`

- [ ] **Step 1:** Ensure build works: `cd apps/storefront && bun run build`
- [ ] **Step 2:** Create `wrangler.toml`:

```toml
# apps/storefront/wrangler.toml
name = "alkemart-storefront"
compatibility_date = "2024-01-01"

[site]
bucket = "./dist"
```

- [ ] **Step 3:** Add deploy script to `package.json`:

```json
{
  "scripts": {
    "deploy": "wrangler pages deploy dist --project-name alkemart-storefront"
  }
}
```

- [ ] **Step 4:** Test deploy: `bun run deploy` (requires Cloudflare auth)
- [ ] **Step 5:** Commit: `chore(storefront): add Cloudflare Pages deploy config`

### Task 6.2: Backend -- Dockerfile for Medusa

**Files:**
- Create: `apps/backend/packages/api/Dockerfile`
- Create: `apps/backend/packages/api/.dockerignore`

- [ ] **Step 1:** Create multi-stage Dockerfile:

```dockerfile
# apps/backend/packages/api/Dockerfile
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare bun@1.3.14 --activate

FROM base AS deps
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

FROM base AS build
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM base AS runtime
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./

EXPOSE 9000
CMD ["bun", "run", "start"]
```

- [ ] **Step 2:** Create `.dockerignore`:

```
node_modules
dist
.env
.env.*
*.log
.git
```

- [ ] **Step 3:** Build and test: `docker build -t alkemart-backend .`
- [ ] **Step 4:** Update `fly.toml`:

```toml
# fly.toml
app = "alkemart-api"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[http_service]
  internal_port = 9000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true

  [http_service.checks]
    grace_period = "10s"
    interval = "30s"
    method = "GET"
    path = "/health"
    timeout = "5s"

[http_service.concurrency]
  type = "connections"
  hard_limit = 250
  soft_limit = 200

[[vm]]
  memory = "1gb"
  cpu_kind = "shared"
  cpus = 1
```

- [ ] **Step 5:** Commit: `chore(backend): add production Dockerfile and fly.toml`

### Task 6.3: Update DEPLOYMENT.md

**Files:**
- Modify: `DEPLOYMENT.md`

- [ ] **Step 1:** Rewrite `DEPLOYMENT.md` with current architecture:

```markdown
# Deployment Guide

## Architecture

- **Storefront**: Static SPA on Cloudflare Pages
- **Backend API**: MedusaJS on Fly.io (Docker)
- **Database**: Neon PostgreSQL (serverless)
- **Cache**: Redis (Upstash or Fly Redis)
- **Search**: Meilisearch (optional, Docker)

## Prerequisites

- Neon database provisioned
- Redis instance available
- Cloudflare account (for SPA)
- Fly.io account (for backend)
- Paystack live keys (for payments)

## Environment Variables

### Backend (Fly.io secrets)

```bash
fly secrets set \
  DATABASE_URL="postgresql://..." \
  REDIS_URL="redis://..." \
  JWT_SECRET="$(openssl rand -hex 32)" \
  COOKIE_SECRET="$(openssl rand -hex 32)" \
  STORE_CORS="https://alkemart.com" \
  ADMIN_CORS="https://admin.alkemart.com" \
  AUTH_CORS="https://alkemart.com,https://admin.alkemart.com" \
  PAYSTACK_SECRET_KEY="sk_live_..." \
  PAYSTACK_PUBLIC_KEY="pk_live_..." \
  -a alkemart-api
```

### Storefront (Cloudflare Pages env vars)

```
VITE_MEDUSA_BACKEND_URL=https://api.alkemart.com
VITE_MEDUSA_PUBLISHABLE_KEY=pk_...
VITE_MEDUSA_REGION_ID=reg_...
VITE_MEDUSA_SALES_CHANNEL_ID=...
VITE_MERCUR_VENDOR_URL=https://seller.alkemart.com
VITE_MERCUR_ADMIN_URL=https://admin.alkemart.com
```

## Deploy Steps

1. **Backend**: `fly deploy --config fly.toml --app alkemart-api`
2. **Storefront**: `cd apps/storefront && bun run build && bun run deploy`
3. **Migrations**: `fly ssh console -C "bun run medusa db:migrate" -a alkemart-api`
4. **Seed**: `fly ssh console -C "bun run medusa exec src/scripts/seed.ts" -a alkemart-api`

## Post-Deploy Checks

- [ ] GET /health returns 200
- [ ] Storefront loads at production URL
- [ ] Product list returns real prices
- [ ] Cart create works with region + sales channel
- [ ] Login/register works
- [ ] Checkout flow completes
```

- [ ] **Step 2:** Commit: `docs: rewrite deployment guide for Mercur backend`

---

## Phase 7: Monitoring & Observability

### Task 7.1: Add Sentry for error tracking

**Files:**
- Modify: `apps/storefront/package.json`
- Create: `apps/storefront/src/lib/sentry.ts`
- Modify: `apps/storefront/src/main.tsx`

- [ ] **Step 1:** Install Sentry:

```bash
cd apps/storefront
bun add @sentry/react
```

- [ ] **Step 2:** Create Sentry init:

```typescript
// apps/storefront/src/lib/sentry.ts
import * as Sentry from "@sentry/react"

export function initSentry() {
  if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
    })
  }
}
```

- [ ] **Step 3:** Call in `main.tsx` before `ReactDOM.createRoot`:

```typescript
import { initSentry } from "./lib/sentry"
initSentry()
```

- [ ] **Step 4:** Add `VITE_SENTRY_DSN` to `.env.template`
- [ ] **Step 5:** Commit: `feat(storefront): add Sentry error tracking`

### Task 7.2: Add structured logging to backend

**Files:**
- Create: `apps/backend/packages/api/src/lib/logger.ts`
- Modify: `apps/backend/packages/api/src/api/hooks/paystack/route.ts`

- [ ] **Step 1:** Create logger utility:

```typescript
// apps/backend/packages/api/src/lib/logger.ts
type LogLevel = "debug" | "info" | "warn" | "error"

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  [key: string]: unknown
}

function log(level: LogLevel, message: string, data?: Record<string, unknown>) {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...data,
  }
  console.log(JSON.stringify(entry))
}

export const logger = {
  debug: (msg: string, data?: Record<string, unknown>) => log("debug", msg, data),
  info: (msg: string, data?: Record<string, unknown>) => log("info", msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => log("warn", msg, data),
  error: (msg: string, data?: Record<string, unknown>) => log("error", msg, data),
}
```

- [ ] **Step 2:** Replace `console.log`/`console.error` in webhook handler with `logger.info`/`logger.error`
- [ ] **Step 3:** Add request ID tracking middleware for tracing
- [ ] **Step 4:** Commit: `feat(backend): add structured JSON logging`

---

## Phase 8: Cleanup & Documentation

### Task 8.1: Archive deprecated configs

**Files:**
- Modify: `fly.toml` (root -- add deprecation notice)
- Modify: `Dockerfile` (root -- keep as-is, already exits with error)

- [ ] **Step 1:** Verify root `Dockerfile` already fails with deprecation message
- [ ] **Step 2:** Add comment to root `fly.toml`:

```toml
# DEPRECATED: This config targets the archived Express API.
# Use apps/backend/packages/api/ for the current Medusa backend.
```

- [ ] **Step 3:** Commit: `chore: mark deprecated configs clearly`

### Task 8.2: Update AGENTS.md with new conventions

**Files:**
- Modify: `apps/backend/AGENTS.md`

- [ ] **Step 1:** Add testing conventions:

```markdown
## Testing

- Backend: Jest (`bun run test:unit`, `bun run test:integration:modules`)
- Storefront: Vitest (`bun run test`)
- All PRs must include tests for new features
- Critical paths: auth, checkout, payment webhooks
```

- [ ] **Step 2:** Add security conventions:

```markdown
## Security

- Never commit `.env` files
- All secrets via env vars, validated on boot
- JWT_SECRET and COOKIE_SECRET must be 32+ chars
- Production refuses to start with default secrets
```

- [ ] **Step 3:** Commit: `docs: update AGENTS.md with testing and security conventions`

---

## Execution Summary

| Phase | Tasks | Priority | Estimated Time |
|-------|-------|----------|----------------|
| 1. Security | 3 tasks | CRITICAL | 1-2 hours |
| 2. Error Boundaries | 2 tasks | HIGH | 30 minutes |
| 3. Testing | 2 tasks | HIGH | 1-2 hours |
| 4. Auth Guards | 1 task | HIGH | 30 minutes |
| 5. CI/CD | 2 tasks | MEDIUM | 1 hour |
| 6. Deployment | 3 tasks | MEDIUM | 1-2 hours |
| 7. Monitoring | 2 tasks | LOW | 1 hour |
| 8. Cleanup | 2 tasks | LOW | 30 minutes |

**Total estimated time: 6-10 hours**

## Execution Order

Execute phases sequentially. Each phase must complete before starting the next:

1. **Phase 1** (Security) -- MUST be first. Credentials are compromised.
2. **Phase 2** (Error Boundaries) -- Prevent user-facing crashes.
3. **Phase 3** (Testing) -- Foundation for all future work.
4. **Phase 4** (Auth Guards) -- Protect sensitive routes.
5. **Phase 5** (CI/CD) -- Automate quality checks.
6. **Phase 6** (Deployment) -- Enable production deploys.
7. **Phase 7** (Monitoring) -- Observe production issues.
8. **Phase 8** (Cleanup) -- Documentation and housekeeping.

---

## What We're NOT Doing

- **Framework migration** (no Next.js, no Remix) -- the current stack is fine
- **Auth provider migration** (no BetterAuth, WorkOS, Oso) -- Medusa native auth works
- **Full test coverage** -- focusing on critical paths only
- **E2E tests** -- out of scope for this plan
- **Performance optimization** -- separate concern

---

## Plan saved to

`docs/superpowers/plans/2026-07-18-production-readiness-fix.md`

**Two execution options:**

1. **Subagent-Driven (recommended)** -- dispatch fresh subagent per task, review between tasks
2. **Inline Execution** -- execute tasks in this session with checkpoints

Which approach?
