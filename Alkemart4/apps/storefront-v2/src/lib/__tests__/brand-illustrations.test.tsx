import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { BrandIllustration, brandIllustrations } from "@workspace/console-ui/components/brand-illustration"

afterEach(cleanup)

describe("shared brand illustrations", () => {
  it("maps every scene to a real bundled PNG instead of missing public URLs", () => {
    expect(new Set(Object.values(brandIllustrations)).size).toBe(10)
    for (const src of Object.values(brandIllustrations)) expect(src).toMatch(/\.png/)
    expect(brandIllustrations["empty-shelf"]).toBe(brandIllustrations["first-listing"])
  })

  it("keeps artwork decorative and provides a fallback on failure", () => {
    const { container, rerender } = render(<BrandIllustration name="empty-cart" fallback={<span>Fallback icon</span>} />)
    const img = container.querySelector("img")!
    expect(img.getAttribute("alt")).toBe("")
    expect(img.getAttribute("aria-hidden")).toBe("true")
    fireEvent.error(img)
    expect(screen.getByText("Fallback icon")).toBeTruthy()
    rerender(<BrandIllustration name="empty-orders" />)
    expect(container.querySelector("img")?.getAttribute("src")).toBe(brandIllustrations["empty-orders"])
  })
})
