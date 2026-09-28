import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PromoCarousel } from "@/components/home/promo-carousel"

vi.mock("@/components/commerce/smart-link", () => ({ SmartLink: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }))
vi.mock("@/lib/env", () => ({ getVendorAppUrl: () => "https://seller.example.com" }))

const section = { id: "deals-band", type: "promo_band" as const, layout: "cover" as const, theme: "black" as const, title: "Deals", imageUrl: "/original.jpg", action: { label: "Explore deals", href: "/categories/all" } }
let reduced = false
let desktop = true

beforeEach(() => {
  vi.useFakeTimers()
  reduced = false
  desktop = true
  vi.stubGlobal("IntersectionObserver", class {
    callback: (entries: { isIntersecting: boolean }[]) => void
    constructor(callback: (entries: { isIntersecting: boolean }[]) => void) { this.callback = callback }
    observe() { this.callback([{ isIntersecting: true }]) }
    disconnect() {}
  })
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduced-motion") ? reduced : desktop, addEventListener() {}, removeEventListener() {} }))
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe("desktop campaign carousel", () => {
  it("rotates, pauses and keeps only the active slide accessible", () => {
    render(<PromoCarousel section={section} />)
    expect(screen.getAllByRole("group")).toHaveLength(1)
    act(() => vi.advanceTimersByTime(4000))
    expect(screen.getByRole("heading").textContent).toBe("Compare prices across shops.")
    expect(screen.getByRole("link").getAttribute("href")).toBe("/categories/all")
    fireEvent.click(screen.getByRole("button", { name: "Pause campaigns" }))
    act(() => vi.advanceTimersByTime(13000))
    expect(screen.getByRole("heading").textContent).toBe("Compare prices across shops.")
    fireEvent.click(screen.getByRole("button", { name: "Show campaign 3: Your next find starts here." }))
    expect(screen.getByRole("heading").textContent).toBe("Your next find starts here.")
  })

  it.each(["reduced motion", "mobile"])("does not autoplay with %s", (mode) => {
    reduced = mode === "reduced motion"
    desktop = mode !== "mobile"
    render(<PromoCarousel section={section} />)
    act(() => vi.advanceTimersByTime(20000))
    expect(screen.getByRole("heading").textContent).toBe("See delivery costs before you order.")
  })

  it("pauses on hover and supports keyboard and swipe navigation", () => {
    render(<PromoCarousel section={section} />)
    const carousel = screen.getByRole("region")
    fireEvent.mouseEnter(carousel)
    act(() => vi.advanceTimersByTime(13000))
    expect(screen.getByRole("heading").textContent).toBe("See delivery costs before you order.")
    fireEvent.keyDown(carousel, { key: "ArrowLeft" })
    expect(screen.getByRole("heading").textContent).toBe("Deals")
    fireEvent.pointerDown(carousel, { clientX: 200 })
    fireEvent.pointerUp(carousel, { clientX: 50 })
    expect(screen.getByRole("heading").textContent).toBe("See delivery costs before you order.")
  })
})
