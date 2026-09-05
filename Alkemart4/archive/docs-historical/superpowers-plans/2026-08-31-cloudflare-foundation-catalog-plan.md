# Cloudflare Ghana Multivendor Marketplace — Plan 1: Foundation + Multivendor Catalog

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Cloudflare-native Alkemart API and ship a **multivendor** Ghana catalog: Product↔Offer model, product-centric PLP (`fromPrice` + `offerCount`), PDP peer-offers, seller shop page, pesewas-only DTOs — storefront rewired off Medusa SDK for browse/PDP/seller.

**Architecture:** Hono on Cloudflare Workers + Postgres via two Hyperdrive bindings. **Offer is the sellable unit**; catalog aggregates sellable offers per product; PDP returns all peer offers; ATC will later bind `offer_id` only. Domain in `packages/domain`; schema in `packages/db`. Medusa untouched until cutover.

**Tech Stack:** Bun workspaces, Hono, Drizzle ORM, Neon Postgres + Hyperdrive, Cloudflare Workers/KV/R2, Vitest, OpenAPI 3 + Orval, React 19 + TanStack Router/Query (existing storefront).

**Spec:** `docs/superpowers/specs/2026-08-31-cloudflare-ghana-marketplace-design.md` (§3.1 Multivendor spine)  
**Research:** `docs/superpowers/specs/2026-08-31-taxonomy-ux-dataflow-trust-research.md`

**Plan series:** This is **Plan 1 of 4**. Later plans (not this file):  
- Plan 2 — Identity + **seller-scoped** vendor write + moderation  
- Plan 3 — Multi-seller cart quote + PaymentIntent + MoMo DO + per-offer stock reservation + **OrderGroup / per-seller Orders**  
- Plan 4 — Per-seller fulfillment, payouts, cutover  

## Global Constraints

- **Multivendor spine (§3.1):** Product ≠ Offer; ATC = `offer_id`; PLP product-centric; PDP peer offers; unique `(seller_id, product_id, variant_id)`; never put price/stock on Product.
- Pesewas `bigint` only in DB and API money fields; display via `@alkemart/shared` / one `Price` component (`en-GH`).
- Catalog SoT: `GET /store/catalog` + `GET /store/products/:id` + `GET /store/sellers/:handle` — no dual-fetch rehydrate.
- Taxonomy SoT is DB `categories`; SPA maps handle → icon/art only (no rename table, no title regex).
- `primary_category_id` required; propose targets a leaf (or flat root with no children).
- Fail closed: missing env / missing offer → error, never empty success.
- OpenAPI is the sole client contract; no `@medusajs/js-sdk` on new paths.
- Do not modify or delete `apps/backend` Medusa runtime in this plan (read-only reference).
- Package manager: Bun. Node compat flag required for Hyperdrive drivers.

---

## File structure (this plan)

```
Alkemart4/
  apps/
    api/                          # NEW — Hono Worker
      src/
        index.ts                  # Worker entry, route mount
        env.ts                    # Zod env parse (fail closed)
        routes/
          health.ts
          store/
            catalog.ts            # product-centric PLP cards
            categories.ts
            products.ts           # PDP + peer offers
            sellers.ts            # seller shop
        middleware/
          error.ts
          request-id.ts
      wrangler.toml
      package.json
      vitest.config.ts
    storefront/                   # EXISTING — rewire multivendor browse
      src/lib/
        api-client.ts             # NEW — generated or thin fetch wrapper
        products.ts               # MODIFY — catalog + PDP peer offers
        catalog-nav.ts            # MODIFY — icons only, no label SoT
        offer-filter.ts           # MODIFY — delete title regex
        sellers.ts                # NEW/MODIFY — seller shop fetch
  packages/
    db/                           # NEW
      src/
        schema/
          markets.ts
          categories.ts
          sellers.ts
          products.ts
          offers.ts               # UNIQUE (seller_id, product_id, variant_id)
        index.ts
        migrate.ts
      drizzle.config.ts
    domain/                       # NEW
      src/
        money.ts                  # pesewas brand type + assert
        taxonomy.ts               # leaf checks, nav tree
        sellable.ts               # sellable predicate on offer+product+seller
        catalog.ts                # aggregate offers → ProductCardDto
        offers.ts                 # pickBestOffer, sortPeerOffers
      src/__tests__/
        money.test.ts
        taxonomy.test.ts
        sellable.test.ts
        catalog.test.ts
        offers.test.ts
    api-spec/                     # NEW
      openapi.yaml
    api-client/                   # NEW — Orval output (storefront consumes)
    shared/                       # EXISTING — reuse ghana helpers as-is
```

---

### Task 1: Workspace scaffold (`apps/api`, `packages/db`, `packages/domain`)

**Files:**
- Create: `apps/api/package.json`, `apps/api/wrangler.toml`, `apps/api/tsconfig.json`, `apps/api/src/index.ts`, `apps/api/src/env.ts`, `apps/api/src/routes/health.ts`
- Create: `packages/db/package.json`, `packages/db/tsconfig.json`, `packages/db/src/index.ts`
- Create: `packages/domain/package.json`, `packages/domain/tsconfig.json`, `packages/domain/src/index.ts`
- Modify: `Alkemart4/package.json` (add workspaces if needed)

**Interfaces:**
- Consumes: nothing
- Produces: Worker exports `fetch`; `parseEnv(env)` returns typed `ApiEnv`; `GET /health` → `{ ok: true, service: "alkemart-api" }`

- [ ] **Step 1: Create `packages/domain/package.json`**

```json
{
  "name": "@alkemart/domain",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@alkemart/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "~5.9.3",
    "vitest": "^4.1.10"
  }
}
```

- [ ] **Step 2: Create `packages/db/package.json`**

```json
{
  "name": "@alkemart/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "generate": "drizzle-kit generate",
    "migrate": "drizzle-kit migrate",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "drizzle-orm": "^0.44.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.31.0",
    "typescript": "~5.9.3"
  }
}
```

- [ ] **Step 3: Create `apps/api/package.json` + `wrangler.toml`**

```json
{
  "name": "@alkemart/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@alkemart/db": "workspace:*",
    "@alkemart/domain": "workspace:*",
    "@alkemart/shared": "workspace:*",
    "hono": "^4.7.0",
    "drizzle-orm": "^0.44.0",
    "postgres": "^3.4.5",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20250801.0",
    "typescript": "~5.9.3",
    "vitest": "^4.1.10",
    "wrangler": "^4.0.0"
  }
}
```

```toml
name = "alkemart-api"
main = "src/index.ts"
compatibility_date = "2026-08-28"
compatibility_flags = ["nodejs_compat"]

[[hyperdrive]]
binding = "HYPERDRIVE"
id = "REPLACE_WITH_CACHED_HYPERDRIVE_ID"

[[hyperdrive]]
binding = "HYPERDRIVE_PRIMARY"
id = "REPLACE_WITH_PRIMARY_HYPERDRIVE_ID"

[[kv_namespaces]]
binding = "CATALOG_KV"
id = "REPLACE_WITH_KV_ID"
```

- [ ] **Step 4: Implement fail-closed `env.ts` + health route + entry**

```ts
// apps/api/src/env.ts
import { z } from "zod"

const EnvSchema = z.object({
  ENVIRONMENT: z.enum(["development", "staging", "production"]).default("development"),
})

export type ApiEnv = z.infer<typeof EnvSchema> & {
  HYPERDRIVE: { connectionString: string }
  HYPERDRIVE_PRIMARY: { connectionString: string }
  CATALOG_KV: KVNamespace
}

export function parseEnv(env: Record<string, unknown>): ApiEnv {
  const base = EnvSchema.parse(env)
  if (!env.HYPERDRIVE || !env.HYPERDRIVE_PRIMARY || !env.CATALOG_KV) {
    throw new Error("Missing Hyperdrive or CATALOG_KV bindings")
  }
  return {
    ...base,
    HYPERDRIVE: env.HYPERDRIVE as ApiEnv["HYPERDRIVE"],
    HYPERDRIVE_PRIMARY: env.HYPERDRIVE_PRIMARY as ApiEnv["HYPERDRIVE_PRIMARY"],
    CATALOG_KV: env.CATALOG_KV as KVNamespace,
  }
}
```

```ts
// apps/api/src/routes/health.ts
import { Hono } from "hono"
export const health = new Hono().get("/", (c) =>
  c.json({ ok: true, service: "alkemart-api" }),
)
```

```ts
// apps/api/src/index.ts
import { Hono } from "hono"
import { parseEnv, type ApiEnv } from "./env"
import { health } from "./routes/health"

const app = new Hono<{ Bindings: ApiEnv }>()
app.get("/health", (c) => {
  parseEnv(c.env as unknown as Record<string, unknown>)
  return c.json({ ok: true, service: "alkemart-api" })
})
app.route("/health", health)

export default app
```

- [ ] **Step 5: Install + typecheck**

Run from `Alkemart4/`:
```bash
bun install
cd apps/api && bun run typecheck
```
Expected: PASS (or only intentional REPLACE id warnings in wrangler — types clean)

- [ ] **Step 6: Commit**

```bash
git add apps/api packages/db packages/domain package.json bun.lock
git commit -m "feat(api): scaffold Cloudflare Workers Hono app and packages"
```

---

### Task 2: Money + taxonomy domain (pesewas brand, leaf rules)

**Files:**
- Create: `packages/domain/src/money.ts`, `packages/domain/src/taxonomy.ts`, `packages/domain/src/index.ts`
- Test: `packages/domain/src/__tests__/money.test.ts`, `packages/domain/src/__tests__/taxonomy.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type Pesewas = bigint & { readonly __brand: "Pesewas" }`
  - `asPesewas(n: number | bigint): Pesewas` — throws if not finite integer ≥ 0
  - `type CategoryNode = { id: string; handle: string; name: string; parentId: string | null; children: CategoryNode[] }`
  - `assertLeafCategory(node: CategoryNode): void` — throws if `children.length > 0`
  - `buildNavTree(rows: Array<{ id: string; handle: string; name: string; parentId: string | null; rank: number }>): CategoryNode[]`

- [ ] **Step 1: Write failing money tests**

```ts
// packages/domain/src/__tests__/money.test.ts
import { describe, it, expect } from "vitest"
import { asPesewas } from "../money"

describe("asPesewas", () => {
  it("accepts integer bigint", () => {
    expect(asPesewas(2500n)).toBe(2500n)
  })
  it("rejects fractional number", () => {
    expect(() => asPesewas(12.5)).toThrow(/pesewas/i)
  })
  it("rejects negative", () => {
    expect(() => asPesewas(-1)).toThrow(/pesewas/i)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd packages/domain && bun run test
```
Expected: FAIL — `asPesewas` not defined / cannot find module

- [ ] **Step 3: Implement money.ts**

```ts
export type Pesewas = bigint & { readonly __brand: "Pesewas" }

export function asPesewas(n: number | bigint): Pesewas {
  if (typeof n === "number") {
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
      throw new Error("pesewas must be a non-negative integer")
    }
    return BigInt(n) as Pesewas
  }
  if (n < 0n) throw new Error("pesewas must be a non-negative integer")
  return n as Pesewas
}
```

- [ ] **Step 4: Write failing taxonomy tests + implement**

```ts
// packages/domain/src/__tests__/taxonomy.test.ts
import { describe, it, expect } from "vitest"
import { assertLeafCategory, buildNavTree } from "../taxonomy"

describe("taxonomy", () => {
  it("builds a two-level tree sorted by rank", () => {
    const tree = buildNavTree([
      { id: "1", handle: "phones-electronics", name: "Phones & Electronics", parentId: null, rank: 0 },
      { id: "2", handle: "phones", name: "Phones", parentId: "1", rank: 0 },
      { id: "3", handle: "accessories", name: "Accessories", parentId: "1", rank: 1 },
    ])
    expect(tree).toHaveLength(1)
    expect(tree[0].children.map((c) => c.handle)).toEqual(["phones", "accessories"])
  })
  it("assertLeafCategory rejects parents", () => {
    const tree = buildNavTree([
      { id: "1", handle: "phones-electronics", name: "Phones & Electronics", parentId: null, rank: 0 },
      { id: "2", handle: "phones", name: "Phones", parentId: "1", rank: 0 },
    ])
    expect(() => assertLeafCategory(tree[0])).toThrow(/leaf/i)
    expect(() => assertLeafCategory(tree[0].children[0])).not.toThrow()
  })
})
```

```ts
// packages/domain/src/taxonomy.ts
export type CategoryNode = {
  id: string
  handle: string
  name: string
  parentId: string | null
  children: CategoryNode[]
}

export function buildNavTree(
  rows: Array<{ id: string; handle: string; name: string; parentId: string | null; rank: number }>,
): CategoryNode[] {
  const sorted = [...rows].sort((a, b) => a.rank - b.rank || a.handle.localeCompare(b.handle))
  const map = new Map<string, CategoryNode>()
  for (const r of sorted) {
    map.set(r.id, { id: r.id, handle: r.handle, name: r.name, parentId: r.parentId, children: [] })
  }
  const roots: CategoryNode[] = []
  for (const r of sorted) {
    const node = map.get(r.id)!
    if (r.parentId && map.has(r.parentId)) map.get(r.parentId)!.children.push(node)
    else roots.push(node)
  }
  return roots
}

export function assertLeafCategory(node: CategoryNode): void {
  if (node.children.length > 0) throw new Error("category must be a leaf")
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd packages/domain && bun run test
```

- [ ] **Step 6: Commit**

```bash
git add packages/domain
git commit -m "feat(domain): pesewas brand type and category leaf/nav helpers"
```

---

### Task 3: Drizzle schema — markets, categories, sellers, products, offers

**Files:**
- Create: `packages/db/src/schema/markets.ts`, `categories.ts`, `sellers.ts`, `products.ts`, `offers.ts`, `packages/db/src/schema/index.ts`, `packages/db/drizzle.config.ts`
- Create: `packages/db/src/migrations/` (generated)

**Interfaces:**
- Consumes: none
- Produces: tables `markets`, `categories`, `sellers`, `products`, `product_variants`, `offers` with columns below

Schema requirements (exact):

```ts
// categories: id text pk, handle text unique, name text, parent_id text null references categories, rank int, is_nav boolean default true
// products: id, title, status enum draft|proposed|published|rejected, primary_category_id NOT NULL → categories, seller_id → sellers
// offers: id, seller_id, product_id, variant_id, price_pesewas bigint, on_hand int, reserved int, currency text default 'ghs', active boolean
// UNIQUE (seller_id, product_id, variant_id) — one offer per seller per variant
// available is computed in domain: on_hand - reserved — do NOT store a separate available column
// products do NOT have price or stock columns
```

- [ ] **Step 1: Write schema files matching the requirements above** (use `pgTable` from drizzle-orm/pg-core; `price_pesewas: bigint("price_pesewas", { mode: "bigint" })`; `uniqueIndex` on offers).

- [ ] **Step 2: Generate migration**

```bash
cd packages/db && bun run generate
```
Expected: SQL migration created under `src/migrations/`

- [ ] **Step 3: Apply migration to local/dev Neon (or `wrangler` local postgres if configured)**

```bash
cd packages/db && bun run migrate
```
Expected: success

- [ ] **Step 4: Commit**

```bash
git add packages/db
git commit -m "feat(db): markets categories sellers products offers schema"
```

---

### Task 4: Seed Ghana categories (12 roots + L2 for phones/fashion/food)

**Files:**
- Create: `packages/db/src/seeds/ghana-categories.ts`
- Create: `apps/api/scripts/seed-categories.ts`
- Test: `packages/domain/src/__tests__/ghana-category-seed.test.ts` (assert handles + leaf rules on fixture)

**Interfaces:**
- Consumes: `buildNavTree`, category rows
- Produces: idempotent seed upserting handles from design §4.1:
  - Roots: food-groceries, beverages, fashion-apparel, phones-electronics, home-living, health-beauty, baby-kids, pet-care, agriculture, automotive, services, other
  - L2 under phones-electronics: phones, accessories, computing, tvs-audio
  - L2 under fashion-apparel: men, women, kids, shoes, bags
  - L2 under food-groceries: staples, cooking-oil, snacks

- [ ] **Step 1: Write seed fixture test that expects those handles present and L2 parents correct**

- [ ] **Step 2: Implement seed upsert by handle (ON CONFLICT UPDATE name/rank/parent)**

- [ ] **Step 3: Run seed against dev DB + test**

```bash
cd packages/domain && bun run test
bun run --cwd apps/api scripts/seed-categories.ts
```

- [ ] **Step 4: Commit**

```bash
git add packages/db apps/api/scripts
git commit -m "feat(db): seed Ghana category tree with L2 for phones fashion food"
```

---

### Task 5: Sellable + multivendor catalog/offer mappers

**Files:**
- Create: `packages/domain/src/sellable.ts`, `packages/domain/src/offers.ts`, `packages/domain/src/catalog.ts`
- Test: `packages/domain/src/__tests__/sellable.test.ts`, `offers.test.ts`, `catalog.test.ts`

**Interfaces:**
- Consumes: `Pesewas`, offer/product/seller row shapes
- Produces:

```ts
export type PeerOfferDto = {
  offerId: string
  sellerId: string
  sellerHandle: string
  sellerName: string
  pricePesewas: string
  currency: "ghs"
  available: number // on_hand - reserved
  deliveryFeePesewas: string
}

export type ProductCardDto = {
  productId: string
  title: string
  categoryHandle: string
  categoryName: string
  imageUrl: string | null
  fromPricePesewas: string      // min sellable offer
  bestOfferId: string           // cheapest sellable offer id
  offerCount: number            // count of sellable offers
  currency: "ghs"
}

export type ProductDetailDto = {
  productId: string
  title: string
  description: string | null
  categoryHandle: string
  categoryName: string
  imageUrls: string[]
  offers: PeerOfferDto[]        // sellable only, cheapest first
}

export function isSellable(input: {
  productStatus: "draft" | "proposed" | "published" | "rejected"
  sellerStatus: "pending_approval" | "open" | "suspended" | "terminated"
  offerActive: boolean
  onHand: number
  reserved: number
  pricePesewas: bigint
}): boolean

export function pickBestOffer<T extends { pricePesewas: bigint }>(offers: T[]): T | null
// cheapest among sellable; stable tie-break by offerId

export function toProductCard(product: /* ... */, sellableOffers: /* ... */): ProductCardDto
// throws if sellableOffers.length === 0
```

Rules: sellable iff `published` + seller `open` + `offerActive` + `(onHand - reserved) > 0` + `pricePesewas > 0`.  
**Product with zero sellable offers does not appear on PLP.**

- [ ] **Step 1: Failing tests — sellable matrix (8 cases); pickBestOffer with 3 sellers; toProductCard offerCount=3 fromPrice=min**

- [ ] **Step 2: Implement + pass tests**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(domain): multivendor sellable, best-offer, product card DTOs"
```

---

### Task 6: Store API — categories, catalog, PDP peer offers, seller shop

**Files:**
- Create: `apps/api/src/db.ts`
- Create: `apps/api/src/routes/store/categories.ts`, `catalog.ts`, `products.ts`, `sellers.ts`
- Create: `apps/api/src/middleware/error.ts`
- Modify: `apps/api/src/index.ts` — mount store routes
- Test: `apps/api/src/routes/store/catalog.test.ts`, `products.test.ts`, `sellers.test.ts`
- Create: `apps/api/scripts/seed-multivendor-demo.ts` — 1 product, 2 sellers, 2 offers (different prices)

**Interfaces:**
- `GET /store/categories` → `{ categories: CategoryNode[] }`
- `GET /store/catalog?category=&limit=&offset=` → `{ items: ProductCardDto[], total: number }`  
  - Aggregate sellable offers **per product**; HYPERDRIVE cached binding; KV `catalog:v1:...` TTL 60s
- `GET /store/products/:id` → `ProductDetailDto` (404 if product missing; `offers: []` if none sellable)
- `GET /store/sellers/:handle` → `{ seller: { id, handle, name }, items: ProductCardDto[] }`  
  - Only that seller’s sellable offers, still product-card shaped (`offerCount` may be 1)

- [ ] **Step 1: Write failing tests**
  - Catalog with 2 offers on same product → one card, `offerCount: 2`, `fromPricePesewas` = cheaper
  - PDP returns both peer offers sorted by price
  - Seller shop returns only that seller’s products

- [ ] **Step 2: Implement db client**

```ts
// apps/api/src/db.ts
import postgres from "postgres"
import { drizzle } from "drizzle-orm/postgres-js"
import type { ApiEnv } from "./env"

export function catalogDb(env: ApiEnv) {
  const sql = postgres(env.HYPERDRIVE.connectionString, { max: 5 })
  return drizzle(sql)
}

export function primaryDb(env: ApiEnv) {
  const sql = postgres(env.HYPERDRIVE_PRIMARY.connectionString, { max: 5 })
  return drizzle(sql)
}
```

- [ ] **Step 3: Implement routes + seed script; tests PASS**

- [ ] **Step 4: Manual smoke**

```bash
cd apps/api && bunx wrangler dev
curl -s "localhost:8787/store/catalog?limit=5"
curl -s "localhost:8787/store/products/PRODUCT_ID"
curl -s "localhost:8787/store/sellers/seller-a"
```
Expected: catalog card has `offerCount` ≥ 1 and `fromPricePesewas`; PDP `offers` array length ≥ 2 for demo product; no product-level `price` field

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(api): multivendor catalog, peer offers PDP, seller shop"
```

---

### Task 7: OpenAPI contract + generated client

**Files:**
- Create: `packages/api-spec/openapi.yaml`
- Create: `packages/api-client/` (Orval)
- Modify: storefront depends on `@alkemart/api-client`

**Interfaces:**
- Schemas: `ProductCard`, `PeerOffer`, `ProductDetail`, `CategoryNode`, `SellerShopResponse`
- Client: `getCatalog`, `getCategories`, `getProduct(id)`, `getSellerShop(handle)`

- [ ] **Step 1: Write `openapi.yaml` matching DTOs (`fromPricePesewas`, `offerCount`, `offers[]`)**

- [ ] **Step 2: Generate client**

- [ ] **Step 3: Typecheck storefront import**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(api-spec): OpenAPI for multivendor catalog PDP seller shop"
```

---

### Task 8: Storefront rewire — multivendor browse UX

**Files:**
- Modify: `apps/storefront/src/lib/products.ts` — `getCatalog` / `getProduct`; remove Medusa dual-fetch
- Modify: `apps/storefront/src/lib/catalog-nav.ts` — API names; icons by handle only
- Modify: `apps/storefront/src/lib/offer-filter.ts` — delete title regex
- Modify: PDP route component — render **peer offers** list; ATC disabled or stub until Plan 3 but must require selected `offerId`
- Modify: Product card UI — show `formatGHS(fromPricePesewas)` and “N sellers” when `offerCount > 1`
- Modify/Create: seller shop route using `getSellerShop`
- Modify: `apps/storefront/src/lib/env.ts` — `VITE_ALKEMART_API_URL` fail closed
- Test: offer-filter; product card copy for offerCount; PDP requires offer selection when multiple offers

**Interfaces:**
- Consumes: `getCatalog`, `getCategories`, `getProduct`, `getSellerShop`
- Produces: multivendor PLP/PDP/seller shop without inventing prices or sellers

- [ ] **Step 1: Failing tests — no regex invent; card with offerCount=2 shows sellers hint; PDP with 2 offers does not auto-ATC without selection**

- [ ] **Step 2: Implement UI + data wiring; tests pass**

- [ ] **Step 3: Typecheck + vitest**

```bash
cd apps/storefront && bun run typecheck && bun run test
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(storefront): multivendor PLP peer-offer PDP and seller shop"
```

---

### Task 9: Plan 1 exit gates (multivendor + trust)

**Files:**
- Create: `docs/superpowers/plans/2026-08-31-cloudflare-plan1-exit-checklist.md`

- [ ] **Step 1: Verify all gates**

| Gate | How to verify |
|---|---|
| Two sellers → one PLP card | Demo seed: `offerCount: 2`, single `productId` |
| `fromPricePesewas` = min offer | Cheaper seller’s price on card |
| PDP lists both offers | `/store/products/:id` → `offers.length === 2` |
| Seller shop isolation | `/store/sellers/a` excludes seller B offers |
| No price/stock on Product schema | `products` table has no price columns |
| Unique offer constraint | Inserting duplicate (seller, product, variant) fails |
| No major-unit money field | Responses use `*Pesewas` only |
| No title regex | `offer-filter.ts` clean |
| Dual Hyperdrive bindings | `wrangler.toml` |
| Medusa untouched | `git diff apps/backend` empty |

- [ ] **Step 2: Commit checklist**

```bash
git commit -m "docs: Plan 1 multivendor catalog exit checklist"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|---|---|
| Multivendor spine §3.1 | T3, T5, T6, T8, T9 |
| Product ≠ Offer; unique offer | T3 |
| PLP product-centric + offerCount | T5, T6, T8 |
| PDP peer offers | T5, T6, T8 |
| Seller shop | T6, T8 |
| Workers + Hono scaffold | T1 |
| Dual Hyperdrive | T1, T6 |
| Pesewas-only API | T2, T5–T8 |
| Category tree + L2 | T3, T4 |
| Sellable on offer+seller+product | T5 |
| OpenAPI + client | T7 |
| Kill taxonomy inventing | T8 |
| OrderGroup / MoMo / vendor write | **Plans 2–4** |

## Placeholder scan

No TBD/TODO steps.

## Type consistency

- `fromPricePesewas` / `pricePesewas: string` in JSON ↔ `bigint` in domain
- `ProductCardDto`, `PeerOfferDto`, `ProductDetailDto` shared across domain, routes, OpenAPI, client
- `bestOfferId` always references a sellable offer id
