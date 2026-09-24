import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { render } from "@testing-library/react"

let routeId = "/"
vi.mock("@tanstack/react-router", () => ({
  useRouterState: ({ select }: { select: (s: unknown) => unknown }) =>
    select({ matches: [{ routeId }], location: { pathname: routeId } }),
}))

import { ScrollToTop } from "../scroll-to-top"

describe("ScrollToTop", () => {
  let scrollTo: ReturnType<typeof vi.fn>

  beforeEach(() => {
    scrollTo = vi.fn()
    Object.defineProperty(window, "scrollTo", { value: scrollTo, writable: true })
    routeId = "/"
  })
  afterEach(() => vi.clearAllMocks())

  it("does not scroll on first paint", () => {
    render(<ScrollToTop />)
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it("scrolls when the route changes", () => {
    const view = render(<ScrollToTop />)
    routeId = "/product/$id"
    view.rerender(<ScrollToTop />)
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it("stays put when only params or search change within one route", () => {
    // /categories/men -> /categories/women, or applying a facet. Both keep the
    // same routeId. Scrolling here yanked the buyer away from the sidebar
    // control they had just clicked.
    routeId = "/categories/$slug"
    const view = render(<ScrollToTop />)
    view.rerender(<ScrollToTop />)
    view.rerender(<ScrollToTop />)
    expect(scrollTo).not.toHaveBeenCalled()
  })
})
