import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { HomePage } from "@/routes/index"

vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router")
  return {
    ...actual,
    Link: ({ children, ...rest }: { children: React.ReactNode; to?: string; params?: { slug?: string } }) => (
      <a href={`${rest.to ?? "/"}${rest.params?.slug ? `/${rest.params.slug}` : ""}`}>{children}</a>
    ),
    createFileRoute: () => (opts: { component: unknown }) => opts,
  }
})

vi.mock("@/lib/products", () => ({
  listStoreCategories: async () => [],
  fetchFeaturedProducts: async () => [],
  listStoreProducts: async () => ({ products: [], count: 0 }),
}))

function renderHome() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <HomePage />
    </QueryClientProvider>,
  )
}

describe("home course", () => {
  it("renders mosaic before last-offers before delivery before advertise", async () => {
    renderHome()
    const sections = (await screen.findAllByTestId(/section-/)).map((n) => n.getAttribute("data-testid"))
    expect(sections).toEqual([
      "section-mosaic",
      "section-last-offers",
      "section-delivery",
      "section-advertise",
    ])
  })
})
