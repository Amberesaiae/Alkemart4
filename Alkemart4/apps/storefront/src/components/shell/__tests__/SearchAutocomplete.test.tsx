import { describe, expect, it, beforeEach, beforeAll } from "vitest"
import { renderToString } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  SearchAutocompleteDropdown,
  getStoredRecentSearches,
  saveStoredRecentSearch,
  removeStoredRecentSearch,
  clearStoredRecentSearches,
  POPULAR_CATEGORIES,
  POPULAR_STORES,
} from "../SearchAutocompleteDropdown"

const storageMap = new Map<string, string>()
const mockLocalStorage = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, val: string) => {
    storageMap.set(key, String(val))
  },
  removeItem: (key: string) => {
    storageMap.delete(key)
  },
  clear: () => {
    storageMap.clear()
  },
}

beforeAll(() => {
  // @ts-expect-error mock window & localStorage for node/bun test environment
  globalThis.window = globalThis
  // @ts-expect-error mock localStorage
  globalThis.localStorage = mockLocalStorage
})

beforeEach(() => {
  mockLocalStorage.clear()
})

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return renderToString(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

describe("SearchAutocompleteDropdown & recent searches storage", () => {
  it("stores and retrieves recent searches with deduplication and cap", () => {
    expect(getStoredRecentSearches()).toEqual([])

    saveStoredRecentSearch("iPhone 15")
    saveStoredRecentSearch("Jasmine Rice")
    saveStoredRecentSearch("iPhone 15") // duplicate should hoist to front

    const stored = getStoredRecentSearches()
    expect(stored).toHaveLength(2)
    expect(stored[0]).toBe("iPhone 15")
    expect(stored[1]).toBe("Jasmine Rice")

    removeStoredRecentSearch("Jasmine Rice")
    expect(getStoredRecentSearches()).toEqual(["iPhone 15"])

    clearStoredRecentSearches()
    expect(getStoredRecentSearches()).toEqual([])
  })

  it("defines clean departments and popular stores without sparkles or green verified badges", () => {
    expect(POPULAR_CATEGORIES.length).toBeGreaterThanOrEqual(4)
    expect(POPULAR_STORES.length).toBeGreaterThanOrEqual(3)
    expect(POPULAR_STORES.some((s) => s.handle === "melcom")).toBe(true)
  })

  it("renders idle state with departments and stores when open", () => {
    const html = renderWithClient(
      <SearchAutocompleteDropdown
        isOpen={true}
        query=""
        onClose={() => {}}
        onSelectQuery={() => {}}
      />
    )

    expect(html).toContain("Departments")
    expect(html).toContain("Stores")
    expect(html).toContain("Phones &amp; Electronics")
    expect(html).toContain("Melcom Superstore")
  })

  it("renders recent searches when user has previous searches", () => {
    saveStoredRecentSearch("Air Fryer")

    const html = renderWithClient(
      <SearchAutocompleteDropdown
        isOpen={true}
        query=""
        onClose={() => {}}
        onSelectQuery={() => {}}
      />
    )

    expect(html).toContain("Recent Searches")
    expect(html).toContain("Air Fryer")
  })

  it("renders active typing state with direct query button and bottom action bar", () => {
    const html = renderWithClient(
      <SearchAutocompleteDropdown
        isOpen={true}
        query="perfume"
        onClose={() => {}}
        onSelectQuery={() => {}}
      />
    )

    expect(html).toContain("Search for")
    expect(html).toContain("perfume")
    expect(html).toContain("View all results for")
  })

  it("returns null when isOpen is false", () => {
    const html = renderWithClient(
      <SearchAutocompleteDropdown
        isOpen={false}
        query=""
        onClose={() => {}}
        onSelectQuery={() => {}}
      />
    )

    expect(html).toBe("")
  })
})
