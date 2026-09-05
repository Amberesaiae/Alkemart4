# Search Redesign + Sell WCAG — Implementation Plan

> **Agentic workers:** Use subagent-driven-development to implement task-by-task.

**Goal:** Redesign `/search` as a standalone Google-style landing page and fix sell page mobile WCAG.

**Architecture:** Backend gets 3 Redis-backed search history endpoints; frontend gets a new standalone search route (no site header/footer, gold background, own micro-header) + search history hook. Sell page gets WCAG/illustration fixes.

**Tech Stack:** MedusaJS store routes, Redis (ioredis), TanStack Router, Tailwind CSS

## Global Constraints
- No new DB tables — use Redis for search history (same `ioredis` pattern as `catalog-cache.ts`)
- Search history endpoints are unauthenticated (public store) — X-Device-Id header for anonymous tracking
- Gold primary: `#febf31`, text on gold: `#1a1a1a`
- No `text-[10px]` / `text-[11px]` — use `text-sm` minimum
- Touch targets: `min-h-11` minimum (44px)

---

### Task 1: Backend — search history lib

**Files:**
- Create: `packages/api/src/lib/search-history.ts`

- [ ] **Write `search-history.ts`** — Redis-backed service with `track()`, `getHistory()`, `removeOne()`, `clear()`

```typescript
import Redis from "ioredis"

const REDIS_URL = (process.env.REDIS_URL || "").trim()

let client: Redis | null = null
function getClient(): Redis | null {
  if (client === undefined) {
    client = REDIS_URL ? new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 0 }) : null
    if (client) client.catch(() => { client = null })
  }
  return client
}

const RECENT_KEY = (did: string) => `alk:history:recent:${did}`
const FREQ_KEY = "alk:history:freq"
const RECENT_MAX = 10
const FREQ_MAX = 10
const TTL_SEC = 90 * 24 * 3600 // 90 days

export async function trackSearch(opts: { deviceId: string; query: string }) {
  const r = getClient()
  if (!r) return
  const q = opts.query.trim().toLowerCase()
  if (!q) return
  const recentKey = RECENT_KEY(opts.deviceId)
  // Remove existing occurrence, then LPUSH
  await r.lrem(recentKey, 1, q)
  await r.lpush(recentKey, q)
  await r.ltrim(recentKey, 0, RECENT_MAX - 1)
  await r.expire(recentKey, TTL_SEC)
  // Increment frequency counter
  await r.zincrby(FREQ_KEY, 1, q)
  await r.expire(FREQ_KEY, TTL_SEC)
}

export async function getSearchHistory(opts: { deviceId: string }): Promise<{
  recent: string[]
  frequent: string[]
}> {
  const r = getClient()
  if (!r) return { recent: [], frequent: [] }
  const [recent, freq] = await Promise.all([
    r.lrange(RECENT_KEY(opts.deviceId), 0, RECENT_MAX - 1),
    r.zrevrange(FREQ_KEY, 0, FREQ_MAX - 1),
  ])
  return { recent, frequent: freq }
}

export async function removeSearchQuery(opts: { deviceId: string; query: string }) {
  const r = getClient()
  if (!r) return
  const q = opts.query.trim().toLowerCase()
  await r.lrem(RECENT_KEY(opts.deviceId), 0, q)
  await r.zincrby(FREQ_KEY, -1, q)
}

export async function clearSearchHistory(opts: { deviceId: string }) {
  const r = getClient()
  if (!r) return
  await r.del(RECENT_KEY(opts.deviceId))
}
```

- [ ] **Commit**

```
git add packages/api/src/lib/search-history.ts
git commit -m "feat(api): search history Redis service"
```

---

### Task 2: Backend — search history routes

**Files:**
- Create: `packages/api/src/api/store/search/history/route.ts`
- Create: `packages/api/src/api/store/search/track/route.ts`

- [ ] **Create `store/search/history/route.ts`** — GET returns recent+frequent, DELETE removes query or clears

```typescript
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  getSearchHistory,
  removeSearchQuery,
  clearSearchHistory,
} from "../../../../lib/search-history"

function deviceId(req: MedusaRequest): string {
  return (req.headers["x-device-id"] as string) || ""
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const did = deviceId(req)
  if (!did) return res.status(200).json({ recent: [], frequent: [] })
  const result = await getSearchHistory({ deviceId: did })
  res.status(200).json(result)
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const did = deviceId(req)
  if (!did) return res.status(200).json({ ok: true })
  const body = (req.body ?? {}) as { query?: string }
  if (body.query) await removeSearchQuery({ deviceId: did, query: body.query })
  else await clearSearchHistory({ deviceId: did })
  res.status(200).json({ ok: true })
}
```

- [ ] **Create `store/search/track/route.ts`** — POST records a search

```typescript
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { trackSearch } from "../../../../lib/search-history"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const did = (req.headers["x-device-id"] as string) || ""
  const body = (req.body ?? {}) as { query?: string }
  if (did && body.query) await trackSearch({ deviceId: did, query: body.query })
  res.status(200).json({ ok: true })
}
```

- [ ] **Commit**

```
git add packages/api/src/api/store/search/history/route.ts packages/api/src/api/store/search/track/route.ts
git commit -m "feat(api): search history store routes"
```

---

### Task 3: Backend — build & verify

- [ ] **Build API**

```bash
cd /home/amber/alkemart-backend/packages/api && bun run build 2>&1 | tail -5
```

Expected: "Backend build completed successfully"

- [ ] **Commit**

```
git add -A && git commit -m "feat(api): build with search history routes"
```

---

### Task 4: Frontend — search history hook

**Files:**
- Create: `apps/storefront/src/lib/search-history.ts`

- [ ] **Write `search-history.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

const STORAGE_KEY = "alk_device_id"
const HISTORY_KEY = ["store", "search-history"]

function getDeviceId(): string {
  let id = localStorage.getItem(STORAGE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(STORAGE_KEY, id)
  }
  return id
}

function headers() {
  return { "X-Device-Id": getDeviceId(), "Content-Type": "application/json" }
}

async function fetchHistory(): Promise<{ recent: string[]; frequent: string[] }> {
  const base = import.meta.env.VITE_MEDUSA_BACKEND_URL || ""
  const res = await fetch(`${base}/store/search/history`, { headers: headers() })
  if (!res.ok) return { recent: [], frequent: [] }
  return res.json()
}

async function trackSearch(query: string) {
  const base = import.meta.env.VITE_MEDUSA_BACKEND_URL || ""
  await fetch(`${base}/store/search/track`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ query }),
  })
}

async function removeQuery(query: string) {
  const base = import.meta.env.VITE_MEDUSA_BACKEND_URL || ""
  await fetch(`${base}/store/search/history`, {
    method: "DELETE",
    headers: headers(),
    body: JSON.stringify({ query }),
  })
}

async function clearAll() {
  const base = import.meta.env.VITE_MEDUSA_BACKEND_URL || ""
  await fetch(`${base}/store/search/history`, {
    method: "DELETE",
    headers: headers(),
  })
}

export function useSearchHistory() {
  const qc = useQueryClient()
  const history = useQuery({
    queryKey: HISTORY_KEY,
    queryFn: fetchHistory,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  })

  const track = useMutation({
    mutationFn: trackSearch,
    onSuccess: () => qc.invalidateQueries({ queryKey: HISTORY_KEY }),
  })

  const remove = useMutation({
    mutationFn: removeQuery,
    onSuccess: () => qc.invalidateQueries({ queryKey: HISTORY_KEY }),
  })

  const clear = useMutation({
    mutationFn: clearAll,
    onSuccess: () => qc.setQueryData(HISTORY_KEY, { recent: [], frequent: [] }),
  })

  return {
    recent: history.data?.recent ?? [],
    frequent: history.data?.frequent ?? [],
    isLoading: history.isLoading,
    trackSearch: track.mutate,
    removeQuery: remove.mutate,
    clear: clear.mutate,
  }
}
```

- [ ] **Commit**

```
git add apps/storefront/src/lib/search-history.ts
git commit -m "feat(storefront): search history hook"
```

---

### Task 5: Frontend — standalone search page layout

**Files:**
- Create: `apps/storefront/src/components/search/SearchMicroHeader.tsx`
- Create: `apps/storefront/src/components/search/SearchHero.tsx`
- Rewrite: `apps/storefront/src/routes/search.tsx`
- Modify: `apps/storefront/src/routes/__root.tsx`

- [ ] **Create `SearchMicroHeader.tsx`**

```typescript
import { Link } from "@tanstack/react-router"

export function SearchMicroHeader() {
  return (
    <header className="flex items-center justify-between px-4 py-3 sm:px-6">
      <span className="text-xl font-extrabold tracking-tight text-[#1a1a1a]">
        alkemart<span className="text-[#1a1a1a]">.</span>
      </span>
      <Link
        to="/"
        className="inline-flex min-h-11 items-center text-sm font-semibold text-[#1a1a1a] underline underline-offset-2"
      >
        ← Back to shop
      </Link>
    </header>
  )
}
```

- [ ] **Create `SearchHero.tsx`**

```typescript
import { useState, type FormEvent } from "react"
import { useNavigate } from "@tanstack/react-router"
import { IconSafe } from "@/design/icons"
import { POPULAR_SEARCHES } from "@/lib/popular-searches"
import { useSearchHistory } from "@/lib/search-history"

export function SearchHero() {
  const navigate = useNavigate()
  const [q, setQ] = useState("")
  const { recent, frequent, trackSearch, removeQuery } = useSearchHistory()

  function submit(e: FormEvent) {
    e.preventDefault()
    const query = q.trim()
    if (!query) return
    trackSearch(query)
    void navigate({ to: "/search", search: { q: query } })
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        <form onSubmit={submit} role="search" className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#1a1a1a]/60">
            <IconSafe name="search" size={20} />
          </span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search rice, phones, fashion, shops…"
            className="h-14 w-full rounded-full border-2 border-[#1a1a1a]/20 bg-white py-2 pl-12 pr-6 text-base text-[#1a1a1a] outline-none placeholder:text-[#1a1a1a]/40 focus:border-[#1a1a1a]/60 focus-visible:ring-2 focus-visible:ring-[#1a1a1a]/30"
            aria-label="Search products"
            autoFocus
            autoComplete="off"
            enterKeyHint="search"
          />
        </form>

        {recent.length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-bold text-[#1a1a1a]/70">Recent</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {recent.map((term) => (
                <span key={term} className="inline-flex items-center gap-1 rounded-full border border-[#1a1a1a]/20 bg-white/80 px-3 py-1.5 text-sm text-[#1a1a1a]">
                  <button
                    type="button"
                    onClick={() => { void navigate({ to: "/search", search: { q: term } }) }}
                    className="font-medium"
                  >
                    {term}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeQuery(term)}
                    className="ml-1 text-[#1a1a1a]/50 hover:text-[#1a1a1a]"
                    aria-label={`Remove ${term}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="mt-6">
          <h2 className="text-sm font-bold text-[#1a1a1a]/70">Popular now</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {frequent.length > 0
              ? frequent.slice(0, 8).map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => { void navigate({ to: "/search", search: { q: term } }) }}
                    className="rounded-full border border-[#1a1a1a]/20 bg-white/80 px-3 py-1.5 text-sm font-medium text-[#1a1a1a] hover:bg-white"
                  >
                    {term}
                  </button>
                ))
              : POPULAR_SEARCHES.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => { void navigate({ to: "/search", search: { q: term } }) }}
                    className="rounded-full border border-[#1a1a1a]/20 bg-white/80 px-3 py-1.5 text-sm font-medium text-[#1a1a1a] hover:bg-white"
                  >
                    {term}
                  </button>
                ))}
          </div>
        </section>
      </div>
    </div>
  )
}
```

- [ ] **Rewrite `src/routes/search.tsx`** — keep existing results logic but wrap in standalone layout. The file is long, so I'll preserve the search results logic and wrap it in the standalone layout.

- [ ] **Modify `__root.tsx`** — add `isSearchPage` for standalone layout. Add after line 108:
```typescript
const isSearchPage = pathname.startsWith("/search")
```
Add to auth check near line 163:
```typescript
if (isAuthPage || isSearchPage) {
  return (
    <div className="flex min-h-screen flex-col bg-[#febf31]">
      <a href="#main" className="sr-only focus:not-sr-only ...">Skip to content</a>
      <main id="main" tabIndex={-1} className="flex min-h-screen flex-1 flex-col outline-none">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Commit**

- [ ] **Sync to storefront home tree & Vercel deploy**

```
cp -r /mnt/c/src/Alkemart4/apps/storefront/src/* /home/amber/alkemart-storefront/src/
cd /home/amber/alkemart-storefront && vercel --prod --yes
```
