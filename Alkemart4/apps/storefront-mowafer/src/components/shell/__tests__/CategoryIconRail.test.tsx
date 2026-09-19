import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { CategoryIconRail } from "../CategoryIconRail"
import type { RailCategory } from "@/lib/catalog-nav"

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
    ...rest
  }: {
    children: React.ReactNode
    to: string
    params?: { slug: string }
    className?: string
    "data-testid"?: string
  }) => (
    <a href={`/categories/${params?.slug ?? ""}`} data-testid={rest["data-testid"]} className={rest.className}>
      {children}
    </a>
  ),
}))

function makeCat(handle: string, name = handle): RailCategory {
  return {
    id: `id-${handle}`,
    name,
    handle,
    icon: "all",
    children: [],
  }
}

describe("CategoryIconRail", () => {
  it("caps rendered departments at 6", () => {
    const categories = [
      "phones-electronics",
      "fashion-apparel",
      "home-living",
      "health-beauty",
      "baby-kids",
      "food-groceries",
      "pet-care",
      "beverages",
    ].map((h) => makeCat(h))

    render(<CategoryIconRail categories={categories} />)
    const items = screen.getAllByRole("link")
    expect(items.length).toBe(6)
    expect(screen.queryByTestId("rail-item-pet-care")).toBeNull()
  })

  it("renders API labels, not hardcoded board names", () => {
    render(
      <CategoryIconRail
        categories={[makeCat("phones-electronics", "Phones & gadgets")]}
      />,
    )
    expect(screen.getByText("Phones & gadgets")).toBeTruthy()
  })
})
