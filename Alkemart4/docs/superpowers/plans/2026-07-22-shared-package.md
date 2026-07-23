# `@alkemart/shared` Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development or executing-plans to implement. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a reusable `packages/shared/` package (`@alkemart/shared`) that provides Ghana locale data, brand tokens, cn() utility, and ErrorBoundary for consumption by storefront and backend SPAs.

**Architecture:** Pure TypeScript + React peerDependencies. Zero runtime API calls — all geography data is static build-time JSON. Exports barrel from `src/index.ts`. Lives at monorepo root, hoisted via bun workspaces.

**Tech Stack:** TypeScript 5.9, bun workspaces, clsx, tailwind-merge, React 18/19

## Global Constraints

- No runtime API calls for static data
- All Ghana geography data is build-time only (CC-BY-4.0 licensed)
- React and DOM libs are peerDependencies (consumers already have them)
- Exports use `"exports"` map in package.json for clean subpath imports
- Must be consumable by both storefront (React 19) and backend SPAs (React 18)
- Must match existing brand token shape from `apps/storefront/src/design/brand.ts`
- Must match existing cn() from `apps/storefront/src/lib/utils.ts`
- Must match existing ErrorBoundary from `apps/storefront/src/components/error-boundary.tsx`

---

### Task 1: Create package scaffolding

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `@alkemart/shared` package with `src/index.ts` barrel

- [ ] **Create `packages/shared/package.json`**

```json
{
  "name": "@alkemart/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./ghana": "./src/ghana/index.ts"
  },
  "peerDependencies": {
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.3.1",
    "react": "^18.0.0 || ^19.0.0"
  }
}
```

- [ ] **Create `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["es2022", "dom"],
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true
  },
  "include": ["src"]
}
```

- [ ] **Create `packages/shared/src/index.ts`**

```ts
export * from "./ghana"
export * from "./brand"
export * from "./utils"
export * from "./error-boundary"
```

- [ ] **Register in root workspace**

Edit root `package.json` — add `"packages/shared"` to workspaces array:

```json
"workspaces": [
  "apps/storefront",
  "packages/shared",
  "scripts"
],
```

- [ ] **Run `bun install` to link**

Run: `bun install`
Expected: `@alkemart/shared` is resolvable.

---

### Task 2: Ghana data modules

**Files:**
- Create: `packages/shared/src/ghana/regions.ts`
- Create: `packages/shared/src/ghana/phone.ts`
- Create: `packages/shared/src/ghana/currency.ts`
- Create: `packages/shared/src/ghana/address.ts`
- Create: `packages/shared/src/ghana/tax.ts`
- Create: `packages/shared/src/ghana/payment.ts`
- Create: `packages/shared/src/ghana/index.ts`

**Interfaces:**
- Consumes: nothing (pure TS, no deps)
- Produces: exported types and functions used by Task 4 consumers

- [ ] **Create `packages/shared/src/ghana/index.ts`**

```ts
export * from "./regions"
export * from "./phone"
export * from "./currency"
export * from "./address"
export * from "./tax"
export * from "./payment"
```

- [ ] **Create `packages/shared/src/ghana/regions.ts`**

```ts
export interface Region {
  id: string
  name: string
  capital: string
  iso: string | null
  lat: string
  lon: string
}

export interface District {
  id: string
  name: string
  capital: string
  regionId: string
  lat: string
  lon: string
}

export interface Town {
  id: string
  name: string
  districtId: string
  lat: string
  lon: string
}

export const GHANA_REGIONS: Region[] = [
  { id: "GH01", name: "Ahafo", capital: "Goaso", iso: null, lat: "6.9333", lon: "-2.6167" },
  { id: "GH02", name: "Ashanti", capital: "Kumasi", iso: "GH-AH", lat: "6.6667", lon: "-1.6167" },
  { id: "GH03", name: "Bono", capital: "Sunyani", iso: "GH-BO", lat: "7.3333", lon: "-2.3333" },
  { id: "GH04", name: "Bono East", capital: "Techiman", iso: null, lat: "7.5833", lon: "-1.9333" },
  { id: "GH05", name: "Central", capital: "Cape Coast", iso: "GH-CP", lat: "5.5000", lon: "-1.0000" },
  { id: "GH06", name: "Eastern", capital: "Koforidua", iso: "GH-EP", lat: "6.5000", lon: "-0.5000" },
  { id: "GH07", name: "Greater Accra", capital: "Accra", iso: "GH-AA", lat: "5.5667", lon: "-0.2000" },
  { id: "GH08", name: "North East", capital: "Nalerigu", iso: null, lat: "10.5000", lon: "-0.1000" },
  { id: "GH09", name: "Northern", capital: "Tamale", iso: "GH-NP", lat: "9.5000", lon: "-1.0000" },
  { id: "GH10", name: "Oti", capital: "Dambai", iso: null, lat: "7.5000", lon: "0.3000" },
  { id: "GH11", name: "Savannah", capital: "Damongo", iso: null, lat: "9.2500", lon: "-1.8167" },
  { id: "GH12", name: "Upper East", capital: "Bolgatanga", iso: "GH-UE", lat: "10.7833", lon: "-0.8500" },
  { id: "GH13", name: "Upper West", capital: "Wa", iso: "GH-UW", lat: "10.0667", lon: "-2.5000" },
  { id: "GH14", name: "Volta", capital: "Ho", iso: "GH-TV", lat: "6.7667", lon: "0.7333" },
  { id: "GH15", name: "Western", capital: "Sekondi-Takoradi", iso: "GH-WP", lat: "5.0833", lon: "-2.0000" },
  { id: "GH16", name: "Western North", capital: "Sefwi Wiawso", iso: null, lat: "6.2000", lon: "-2.4833" },
] as const

export const GHANA_REGIONS_LIST = GHANA_REGIONS.map((r) => r.name) as readonly string[]

export function getRegionById(id: string): Region | undefined {
  return GHANA_REGIONS.find((r) => r.id === id)
}

export function getRegionByName(name: string): Region | undefined {
  return GHANA_REGIONS.find((r) => r.name.toLowerCase() === name.toLowerCase())
}

export const GHANA_MAJOR_CITIES = [
  "Accra", "Kumasi", "Tamale", "Takoradi", "Cape Coast",
  "Tema", "Sunyani", "Ho", "Koforidua", "Wa", "Bolgatanga",
] as const
```

- [ ] **Create `packages/shared/src/ghana/phone.ts`**

```ts
export const GHANA_COUNTRY_CODE = "+233" as const
export const GHANA_NSN_LENGTH = 9 as const

export const MOBILE_PREFIXES = {
  MTN: ["024", "025", "053", "054", "055", "059"] as const,
  VODAFONE: ["020", "050"] as const,
  AIRTELTIGO: ["026", "027", "056", "057"] as const,
  GLOBACOM: ["023"] as const,
} as const

export const LANDLINE_PREFIXES = {
  ACCRA: ["030"] as const,
  TAKORADI: ["031"] as const,
  KUMASI: ["032"] as const,
  CAPE_COAST: ["033"] as const,
  KOFORIDUA: ["034"] as const,
  SUNYANI: ["035"] as const,
  HO: ["036"] as const,
  TAMALE: ["037"] as const,
  BOLGATANGA: ["038"] as const,
  WA: ["039"] as const,
} as const

export function formatPhone(number: string): string {
  const cleaned = number.replace(/[\s\-\(\)]/g, "")
  const local = cleaned.startsWith("0") ? cleaned.slice(1) : cleaned.startsWith("+233") ? cleaned.slice(4) : cleaned
  if (local.length !== 9) return number
  const prefix = local.slice(0, 3)
  const rest1 = local.slice(3, 6)
  const rest2 = local.slice(6)
  return `+233 ${prefix} ${rest1} ${rest2}`
}

export function detectMobileOperator(phone: string): keyof typeof MOBILE_PREFIXES | null {
  const cleaned = phone.replace(/[\s\-\(\)]/g, "")
  const prefix = cleaned.startsWith("0") ? cleaned.slice(0, 3) : cleaned.startsWith("+233") ? cleaned.slice(4, 7) : cleaned.slice(0, 3)
  for (const [operator, prefixes] of Object.entries(MOBILE_PREFIXES)) {
    if ((prefixes as readonly string[]).includes(prefix)) return operator as keyof typeof MOBILE_PREFIXES
  }
  return null
}
```

- [ ] **Create `packages/shared/src/ghana/currency.ts`**

```ts
export const GHS = {
  code: "GHS" as const,
  name: "Ghanaian Cedi",
  symbol: "GH₵",
  minorUnit: 100,
  locale: "en-GH",
  denominations: {
    notes: [1, 2, 5, 10, 20, 50, 100, 200],
    coins: [0.01, 0.05, 0.10, 0.20, 0.50, 1, 2],
  },
} as const

export function formatGHS(pesewas: number): string {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  }).format(pesewas / 100)
}

export function pesewasToMajor(pesewas: number): number {
  return pesewas / 100
}

export function majorToPesewas(major: number): number {
  return Math.round(major * 100)
}
```

- [ ] **Create `packages/shared/src/ghana/address.ts`**

```ts
import { formatPhone } from "./phone"

export interface GhanaAddress {
  line1: string
  line2?: string
  city: string
  district: string
  region: string
  digitalAddress?: string
  phone: string
  postalCode?: string
}

export const REGION_CODES: Record<string, string> = {
  AH: "Ahafo",
  AS: "Ashanti",
  BO: "Bono",
  BE: "Bono East",
  CP: "Central",
  EP: "Eastern",
  GA: "Greater Accra",
  NE: "North East",
  NP: "Northern",
  OT: "Oti",
  SV: "Savannah",
  UE: "Upper East",
  UW: "Upper West",
  TV: "Volta",
  WP: "Western",
  WN: "Western North",
} as const

export function isValidGpsAddress(code: string): boolean {
  return /^[A-Z]{2}-\d{3}-\d{4}$/.test(code)
}

export function parseGpsAddress(code: string): {
  regionCode: string
  districtCode: string
  uniqueId: string
} | null {
  if (!isValidGpsAddress(code)) return null
  const [regionCode, districtCode, uniqueId] = code.split("-")
  return { regionCode, districtCode, uniqueId }
}

export const GHANA_ADDRESS_COPY = {
  phoneLabel: "Mobile number",
  phonePlaceholder: "024 123 4567",
  phoneHint: "Mobile (024…)",
  addressLabel: "Street / house / area",
  addressPlaceholder: "House number, street, neighbourhood",
  landmarkLabel: "Landmark (optional)",
  landmarkPlaceholder: "Near Goil, blue gate…",
  cityLabel: "City / town",
  cityPlaceholder: "Accra, Kumasi…",
  regionLabel: "Region",
  regionPlaceholder: "Greater Accra…",
  countryLabel: "Country",
  postalLabel: "GhanaPostGPS (optional)",
  postalPlaceholder: "GA-184-1234",
  postalHint: "Optional digital address",
} as const

export function formatGhanaAddress(addr: GhanaAddress): string {
  const lines: string[] = [addr.line1]
  if (addr.line2) lines.push(addr.line2)
  const cityLine = addr.digitalAddress ? `${addr.city} — ${addr.digitalAddress}` : addr.city
  lines.push(cityLine)
  lines.push(addr.district)
  lines.push(addr.region.toUpperCase())
  lines.push("GHANA")
  if (addr.phone) lines.push(`Tel: ${formatPhone(addr.phone)}`)
  return lines.join("\n")
}
```

Note: this file imports `formatPhone` from `./phone`. Since `phone.ts` does not import from `address.ts`, there is no circular dependency.

- [ ] **Create `packages/shared/src/ghana/tax.ts`**

```ts
export const GHANA_VAT = {
  vatRate: 0.15,
  nhilRate: 0.025,
  getfundRate: 0.025,
  effectiveRate: 0.20,
} as const

export const TIN_FORMAT = /^\d{13}$/
export const GHANA_CARD_PIN_PATTERN = /^GHA-\d{9}$/

export function calculateTaxInclusive(netPricePesewas: number): {
  net: number
  vat: number
  nhil: number
  getfund: number
  total: number
} {
  const net = netPricePesewas
  const vat = Math.round(net * GHANA_VAT.vatRate)
  const nhil = Math.round(net * GHANA_VAT.nhilRate)
  const getfund = Math.round(net * GHANA_VAT.getfundRate)
  return { net, vat, nhil, getfund, total: net + vat + nhil + getfund }
}

export function calculateTaxExclusive(grossPricePesewas: number): {
  net: number
  vat: number
  nhil: number
  getfund: number
  total: number
} {
  const net = Math.round(grossPricePesewas / (1 + GHANA_VAT.effectiveRate))
  const vat = Math.round(net * GHANA_VAT.vatRate)
  const nhil = Math.round(net * GHANA_VAT.nhilRate)
  const getfund = Math.round(net * GHANA_VAT.getfundRate)
  return { net, vat, nhil, getfund, total: net + vat + nhil + getfund }
}
```

- [ ] **Create `packages/shared/src/ghana/payment.ts`**

```ts
import { detectMobileOperator } from "./phone"

export const MOMO_PROVIDERS = {
  MTN: { name: "MTN Mobile Money", marketShare: 0.73, prefix: "+233" },
  VODAFONE: { name: "Vodafone Cash", marketShare: 0.23, prefix: "+233" },
  AIRTELTIGO: { name: "AirtelTigo Money", marketShare: 0.04, prefix: "+233" },
} as const

export type MomoProvider = keyof typeof MOMO_PROVIDERS

export function detectMomoProvider(phone: string): MomoProvider | null {
  const operator = detectMobileOperator(phone)
  if (operator === "GLOBACOM") return null
  if (operator === "MTN") return "MTN"
  if (operator === "VODAFONE") return "VODAFONE"
  if (operator === "AIRTELTIGO") return "AIRTELTIGO"
  return null
}
```

---

### Task 3: Brand tokens

**Files:**
- Create: `packages/shared/src/brand.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `Brand` type and `brand` constant, matching storefront's existing shape

- [ ] **Create `packages/shared/src/brand.ts`**

```ts
export const brand = {
  name: "alkemart",
  wordmarkHtml: "alkemart",
  tagline: null as string | null,
  titleSuffix: "alkemart",
  description:
    "Multi-seller marketplace for Ghana — compare prices and pay cash on delivery.",
  faviconSrc: "/logo.svg",
  primary: "#F5C518",
  ink: "#141414",
} as const

export type Brand = typeof brand
```

---

### Task 4: cn() utility

**Files:**
- Create: `packages/shared/src/utils.ts`

**Interfaces:**
- Consumes: `clsx`, `tailwind-merge` (peerDeps)
- Produces: `cn()` function matching storefront's existing implementation

- [ ] **Create `packages/shared/src/utils.ts`**

```ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

---

### Task 5: ErrorBoundary component

**Files:**
- Create: `packages/shared/src/error-boundary.tsx`

**Interfaces:**
- Consumes: `react` (peerDep)
- Produces: `ErrorBoundary` class component matching storefront's existing implementation

- [ ] **Create `packages/shared/src/error-boundary.tsx`**

```tsx
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

---

### Task 6: Migration — update storefront to use shared package

**Files:**
- Modify: `apps/storefront/src/lib/utils.ts` — re-export from `@alkemart/shared`
- Modify: `apps/storefront/src/components/error-boundary.tsx` — re-export from `@alkemart/shared`
- Modify: `apps/storefront/src/design/brand.ts` — re-export from `@alkemart/shared`
- Optionally update `apps/storefront/src/lib/ghana-locale.ts`

**Interfaces:**
- Consumes: `@alkemart/shared` (now resolvable)
- Produces: unified source of truth for brand, cn, ErrorBoundary

- [ ] **Update `apps/storefront/src/lib/utils.ts`**

```ts
export { cn } from "@alkemart/shared"
```

- [ ] **Update `apps/storefront/src/components/error-boundary.tsx`**

```tsx
export { ErrorBoundary } from "@alkemart/shared"
```

- [ ] **Update `apps/storefront/src/design/brand.ts`**

```ts
export { brand, type Brand } from "@alkemart/shared"
```

- [ ] **Update `apps/storefront/src/lib/ghana-locale.ts`**

Import from shared package (or keep as convenience re-exports):

```ts
export { GHANA_REGIONS, GHANA_REGIONS_LIST, GHANA_MAJOR_CITIES, GHANA_ADDRESS_COPY } from "@alkemart/shared"
```

Wait — `GHANA_MAJOR_CITIES` and `GHANA_ADDRESS_COPY` currently exist in the storefront but were not defined in the shared package. Need to either:
1. Add them to the shared package, or
2. Keep them as storefront-specific

Decision: Add `GHANA_MAJOR_CITIES` and `GHANA_ADDRESS_COPY` to the shared package since they're locale data.

Add to `packages/shared/src/ghana/regions.ts`:

```ts
export const GHANA_MAJOR_CITIES = [
  "Accra", "Kumasi", "Tamale", "Takoradi", "Cape Coast",
  "Tema", "Sunyani", "Ho", "Koforidua", "Wa", "Bolgatanga",
] as const
```

Add to `packages/shared/src/ghana/address.ts`:

```ts
export const GHANA_ADDRESS_COPY = {
  phoneLabel: "Mobile number",
  phonePlaceholder: "024 123 4567",
  phoneHint: "Mobile (024…)",
  addressLabel: "Street / house / area",
  addressPlaceholder: "House number, street, neighbourhood",
  landmarkLabel: "Landmark (optional)",
  landmarkPlaceholder: "Near Goil, blue gate…",
  cityLabel: "City / town",
  cityPlaceholder: "Accra, Kumasi…",
  regionLabel: "Region",
  regionPlaceholder: "Greater Accra…",
  countryLabel: "Country",
  postalLabel: "GhanaPostGPS (optional)",
  postalPlaceholder: "GA-184-1234",
  postalHint: "Optional digital address",
} as const
```

- [ ] **Verify storefront typecheck**

Run: `bun run typecheck` (from root)
Expected: No type errors

- [ ] **Verify storefront tests**

Run: `bun test` (from `apps/storefront`)
Expected: All tests pass

---

### Task 7: Integration — add `@alkemart/shared` to ghana-vendor and admin SPAs

**Files:**
- Modify: `apps/backend/apps/ghana-vendor/package.json` — add `@alkemart/shared`
- Modify: `apps/backend/apps/admin/package.json` — add `@alkemart/shared`

**Interfaces:**
- Consumes: `@alkemart/shared` from workspace
- Produces: shared package available at build time for both SPAs

- [ ] **Update `apps/backend/apps/ghana-vendor/package.json`**

```json
"dependencies": {
  "@alkemart/shared": "*",
  "lucide-react": "^1.24.0"
},
```

Also add React/React-DOM as explicit deps (currently missing — they rely on hoisting from `apps/backend`):

```json
"dependencies": {
  "@alkemart/shared": "*",
  "lucide-react": "^1.24.0",
  "react": "^18.3.1",
  "react-dom": "^18.3.1"
},
```

- [ ] **Update `apps/backend/apps/admin/package.json`**

```json
"dependencies": {
  "@alkemart/shared": "*",
  "@mercurjs/admin": "2.2.0",
  "lucide-react": "^1.24.0",
  "recharts": "^3.9.2"
},
```

- [ ] **Run `bun install` from root**

Expected: packages are linked

- [ ] **Verify ghana-vendor build**

Run: `bun run build` (from `apps/backend/apps/ghana-vendor`)
Expected: Build succeeds

- [ ] **Verify admin build**

Run: `bun run build` (from `apps/backend/apps/admin`)
Expected: Build succeeds
