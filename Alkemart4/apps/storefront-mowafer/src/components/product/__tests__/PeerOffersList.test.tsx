import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { PeerOffersList } from "../PeerOffersList"
import type { PeerOffer } from "@/lib/products"

const offer = (id: string, name: string, amount: number): PeerOffer => ({
  offerId: id,
  seller: { id, name, handle: name.toLowerCase() },
  amount,
  currencyCode: "ghs",
})

describe("PeerOffersList", () => {
  it("renders nothing when offers empty", () => {
    const { container } = render(
      <PeerOffersList offers={[]} activeOfferId={null} onSelect={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("calls onSelect with offer id", () => {
    const onSelect = vi.fn()
    render(
      <PeerOffersList
        offers={[offer("o1", "Shop A", 12), offer("o2", "Shop B", 10)]}
        activeOfferId="o1"
        onSelect={onSelect}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /Shop B/i }))
    expect(onSelect).toHaveBeenCalledWith("o2")
  })
})
