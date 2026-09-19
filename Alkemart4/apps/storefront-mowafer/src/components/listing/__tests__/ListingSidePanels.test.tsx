import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { ListingSidePanels } from "../ListingSidePanels"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, params }: { children: React.ReactNode; params?: { slug: string } }) => (
    <a href={`/categories/${params?.slug ?? ""}`}>{children}</a>
  ),
}))

describe("ListingSidePanels", () => {
  it("applies department accent to categories panel", () => {
    render(
      <ListingSidePanels
        department="home-living"
        departmentName="Home & living"
        categories={[{ id: "1", name: "Home & living", handle: "home-living" }]}
        sellers={[{ handle: "shop-a", name: "Shop A" }]}
        selectedSellers={[]}
        onToggleSeller={() => {}}
      />,
    )
    expect(screen.getByTestId("panel-categories").className).toMatch(/dept|home-pet|accent/)
    expect(screen.getByTestId("panel-brands").className).toMatch(/panel-brands/)
  })
})
