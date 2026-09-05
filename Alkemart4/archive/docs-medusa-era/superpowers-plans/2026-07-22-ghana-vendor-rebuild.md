# Ghana-Vendor SPA Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development to implement this plan task-by-task.

**Goal:** Rewrite the ghana-vendor SPA from scratch with TanStack Router, Tailwind v4 + shadcn/ui, `@mercurjs/client`, and `@alkemart/shared`.

**Architecture:** Same-origin SPA bundled with API, served at `/seller/`. TanStack Router file-based routes. TanStack Query for data. Typed API client via `@mercurjs/client` codegen.

**Tech Stack:** React 18, TanStack Router, TanStack Query, Tailwind v4, shadcn/ui (manual setup), `@mercurjs/client`, `@alkemart/shared`, lucide-react, vite 5.

## Global Constraints

- No `@medusajs/ui` or `@medusajs/icons` — use shadcn/ui + lucide-react
- No `@mercurjs/dashboard-sdk` — standalone app
- Auth via session cookie (`/vendor/alkemart/me`)
- All brand tokens from `@alkemart/shared` (`brand.primary`, `brand.ink`, etc.)
- Ghana locale data from `@alkemart/shared/ghana`
- `cn()` utility from `@alkemart/shared`
- ErrorBoundary from `@alkemart/shared`
- File-based routing under `src/routes/` (TanStack Router convention)
- vite base: `/seller/`
- Existing `vite.config.ts` and proxy config preserved

---

### Task 1: Dependency setup and configuration

**Files:**
- Modify: `apps/backend/apps/ghana-vendor/package.json`
- Modify: `apps/backend/apps/ghana-vendor/tsconfig.json`
- Modify: `apps/backend/apps/ghana-vendor/vite.config.ts`
- Create: `apps/backend/apps/ghana-vendor/tailwind.config.ts` (if needed for v4)
- Create: `apps/backend/apps/ghana-vendor/src/styles/index.css`
- Create: `apps/backend/apps/ghana-vendor/src/lib/mercur.ts`
- Create: `apps/backend/apps/ghana-vendor/src/lib/auth.ts`
- Create: `apps/backend/apps/ghana-vendor/components.json` (shadcn)

**Interfaces:**
- Consumes: `@alkemart/shared` (available from workspace)
- Produces: configured dev environment with Tailwind, shadcn, TanStack Router, TanStack Query

**Steps:**

- [ ] **Update `package.json` to add new dependencies**

Add:
```json
"dependencies": {
  "@alkemart/shared": "*",
  "@mercurjs/client": "2.2.0",
  "@tanstack/react-query": "5.64.2",
  "@tanstack/react-router": "^1.170.16",
  "@tanstack/react-form": "^1.2.0",
  "lucide-react": "^1.24.0",
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "tailwind-merge": "^3.3.1",
  "clsx": "^2.1.1",
  "class-variance-authority": "^0.7.1"
},
"devDependencies": {
  "@types/react": "^18.3.2",
  "@types/react-dom": "^18.2.25",
  "@vitejs/plugin-react": "^5.2.0",
  "@tailwindcss/vite": "^4.1.14",
  "@tanstack/router-plugin": "^1.168.18",
  "tailwindcss": "^4.1.14",
  "typescript": "5.9.3",
  "vite": "^5.4.21"
}
```

- [ ] **Update `tsconfig.json` to set up path aliases**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Update `vite.config.ts` with Tailwind and TanStack Router plugin**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

export default defineConfig({
  base: '/seller/',
  plugins: [
    TanStackRouterVite({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 7002,
    proxy: {
      '/vendor': 'http://localhost:9000',
      '/auth': 'http://localhost:9000',
      '/store': 'http://localhost:9000',
    },
  },
})
```

- [ ] **Create `src/styles/index.css` with Tailwind import + brand tokens**

```css
@import "tailwindcss";

@theme {
  --color-brand-primary: #F5C518;
  --color-brand-ink: #141414;
  --color-brand-surface: #ffffff;
  --color-brand-muted: #f5f5f5;
  --color-brand-border: #e5e5e5;
}

@layer base {
  body {
    @apply bg-brand-surface text-brand-ink antialiased;
  }
}
```

- [ ] **Create `src/lib/mercur.ts` — typed API client**

```ts
import Medusa from "@mercurjs/client"

export const sdk = new Medusa({
  baseUrl: "",
  auth: {
    type: "session",
  },
})

export type { HttpTypes } from "@mercurjs/client"
```

- [ ] **Create `src/lib/auth.ts` — auth hooks**

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "./mercur"

type Seller = {
  id: string
  name: string
  email: string
  profile?: { name?: string; phone?: string }
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ["seller", "me"],
    queryFn: async () => {
      const res = await fetch("/vendor/alkemart/me", {
        credentials: "include",
        headers: { Accept: "application/json" },
      })
      if (!res.ok) throw new Error("Not authenticated")
      return (await res.json()) as Seller
    },
    staleTime: 0,
    retry: false,
  })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      await fetch("/auth/seller/emailpass", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["seller", "me"] }),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await fetch("/auth/seller/emailpass", { method: "DELETE", credentials: "include" })
    },
    onSuccess: () => qc.clear(),
  })
}
```

- [ ] **Run `bun install` from `apps/backend/` to link deps**

Expected: all packages resolved.

---

### Task 2: Route structure and auth guard

**Files:**
- Create: `apps/backend/apps/ghana-vendor/src/main.tsx`
- Create: `apps/backend/apps/ghana-vendor/src/route-tree.ts`
- Create: `apps/backend/apps/ghana-vendor/src/routes/index.tsx`
- Create: `apps/backend/apps/ghana-vendor/src/routes/login.tsx`
- Create: `apps/backend/apps/ghana-vendor/src/routes/register.tsx`
- Create: `apps/backend/apps/ghana-vendor/src/routes/orders/index.tsx`
- Create: `apps/backend/apps/ghana-vendor/src/routes/orders/$id.tsx`
- Create: `apps/backend/apps/ghana-vendor/src/routes/products.tsx`
- Create: `apps/backend/apps/ghana-vendor/src/routes/quick-sell.tsx`
- Create: `apps/backend/apps/ghana-vendor/src/routes/settings.tsx`
- Delete: `apps/backend/apps/ghana-vendor/src/App.tsx`
- Delete: `apps/backend/apps/ghana-vendor/src/pages/*`
- Delete: `apps/backend/apps/ghana-vendor/src/styles/ghana-vendor.css`
- Delete: `apps/backend/apps/ghana-vendor/src/components/ui.tsx`

**Interfaces:**
- Consumes: auth hooks from Task 1
- Produces: working route structure with auth-protected routes

**Steps:**

- [ ] **Create `main.tsx` — app entry point with providers**

```tsx
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider, createRouter } from "@tanstack/react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ErrorBoundary } from "@alkemart/shared"
import { routeTree } from "./route-tree"
import "./styles/index.css"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 1 },
  },
})

const router = createRouter({ routeTree, context: { queryClient } })

declare module "@tanstack/react-router" {
  interface Register { router: typeof router }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
)
```

- [ ] **Create `route-tree.ts` — root route with auth layout**

```tsx
import { createRootRoute, createRoute, createRouter, redirect } from "@tanstack/react-router"
import { useCurrentUser } from "@/lib/auth"
import { Layout } from "@/components/layout"

const rootRoute = createRootRoute({
  component: () => {
    const { data: user, isLoading } = useCurrentUser()
    // ... render Layout with user context
  },
})
```

- [ ] **For each route, create a TanStack Router route definition**

Pattern for auth-protected routes:
```tsx
import { createRoute } from "@tanstack/react-router"
import { rootRoute } from "@/route-tree"

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage,
})

function DashboardPage() {
  return <div>Dashboard</div>
}

export default dashboardRoute
```

- [ ] **Delete old files**: `App.tsx`, `pages/`, `styles/ghana-vendor.css`, `components/ui.tsx`

- [ ] **Verify the app builds**: `bun run build` (from ghana-vendor dir)

Expected: build succeeds, route tree generates.

---

### Task 3: Layout component

**Files:**
- Create: `apps/backend/apps/ghana-vendor/src/components/layout.tsx`

**Interfaces:**
- Consumes: `useCurrentUser`, `useLogout` from Task 1 lib
- Produces: sidebar layout wrapper used by all authenticated routes

**Steps:**

- [ ] **Create `layout.tsx`** — sidebar + top bar with nav items, user info, logout

Key nav items: Dashboard, Quick Sell, Products, Orders, Settings
Use lucide-react icons: LayoutDashboard, Zap, Package, ShoppingCart, Settings
Brand logo from `@alkemart/shared`'s `brand.wordmarkHtml`
Sidebar collapsible on mobile, fixed on desktop.
Logout button triggers `useLogout()` mutation.

---

### Task 4: Login page

**Files:**
- Create: `apps/backend/apps/ghana-vendor/src/routes/login.tsx`

**Interfaces:**
- Consumes: `useLogin` from `@/lib/auth`
- Produces: login page with email/password form, redirects on success

**Steps:**

- [ ] Build login page with:
  - Centered card layout with brand logo
  - Email + password fields (shadcn Input)
  - Submit button (shadcn Button)
  - Error display for invalid credentials
  - Link to register page
  - On success: router redirect to `/`
  - Use `useLogin().mutateAsync(...)` for submission
  - Show loading state on button during mutation

---

### Task 5: Dashboard page

**Files:**
- Create: `apps/backend/apps/ghana-vendor/src/routes/index.tsx`

**Interfaces:**
- Consumes: `sdk` from `@/lib/mercur`, `useCurrentUser`
- Produces: sales summary cards, recent orders list, quick stats

**Steps:**

- [ ] Build dashboard with:
  - 4 stat cards: Total sales (GHS), Active products, Pending orders, This month
  - Recent orders table (last 5) with status badges
  - Quick actions: New product, Quick sell
  - Greeting with seller name from `useCurrentUser`
  - Format GHS amounts using `formatGHS` from `@alkemart/shared/ghana`

---

### Task 6: Products page

**Files:**
- Create: `apps/backend/apps/ghana-vendor/src/routes/products.tsx`

**Interfaces:**
- Consumes: `sdk` from `@/lib/mercur`
- Produces: product list with status, search, and create button

**Steps:**

- [ ] Build products page with:
  - Table of seller's products (columns: name, price, status, stock, actions)
  - Status filter tabs (All, Published, Draft, Rejected)
  - Search input
  - "New Product" button linking to quick-sell
  - TanStack Query: `useQuery({ queryKey: ["seller", "products"], queryFn: () => sdk.admin.product.list(...) })`
  - Loading skeleton, empty state, error state

---

### Task 7: Orders pages

**Files:**
- Create: `apps/backend/apps/ghana-vendor/src/routes/orders/index.tsx`
- Create: `apps/backend/apps/ghana-vendor/src/routes/orders/$id.tsx`

**Interfaces:**
- Consumes: `sdk` from `@/lib/mercur`
- Produces: order list + order detail pages

**Steps:**

- [ ] Build orders list page:
  - Table of seller's orders (order ID, customer, items, total, status, date)
  - Filters: status, date range
  - Click row → navigate to order detail
- [ ] Build order detail page:
  - Order metadata (ID, date, status, customer info)
  - Line items table
  - Status timeline / history
  - Shipping address (formatted with `formatGhanaAddress` from `@alkemart/shared/ghana`)
  - Total breakdown (formatGHS)

---

### Task 8: Quick Sell page

**Files:**
- Create: `apps/backend/apps/ghana-vendor/src/routes/quick-sell.tsx`

**Interfaces:**
- Consumes: `sdk` from `@/lib/mercur`
- Produces: create offer form

**Steps:**

- [ ] Build quick sell page with:
  - Product selector (search + select existing or create new)
  - Price input (GHS, formatted with formatGHS)
  - Photo upload (file input with preview)
  - Quantity / stock input
  - Submit button
  - Validation with react-hook-form or controlled state

---

### Task 9: Settings page

**Files:**
- Create: `apps/backend/apps/ghana-vendor/src/routes/settings.tsx`

**Interfaces:**
- Consumes: `sdk`, `useCurrentUser`
- Produces: profile, address, and payout settings form

**Steps:**

- [ ] Build settings page with sections:
  - Profile: name, email, phone (formatted via `formatPhone` from shared)
  - Address: street, city, region (dropdown from `GHANA_REGIONS`/`GHANA_REGIONS_LIST`), digital address (GhanaPost GPS)
  - Payout: mobile money provider (detected via `detectMomoProvider`), MoMo number
  - Save button per section with mutation

---

### Task 10: Register page

**Files:**
- Create: `apps/backend/apps/ghana-vendor/src/routes/register.tsx`

**Interfaces:**
- Consumes: none (standalone page)
- Produces: seller registration form

**Steps:**

- [ ] Build register page with:
  - Name, email, phone, password fields
  - Terms acceptance checkbox
  - Submit → POST to `/vendor/alkemart/sellers` or similar
  - On success → redirect to `/login`
  - Validation: phone format, email format, password length
  - Use Ghana locale hint from `@alkemart/shared`'s `GHANA_ADDRESS_COPY`
