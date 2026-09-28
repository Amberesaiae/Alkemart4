import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import {
  CartSkeleton,
  FilterSkeleton,
  MosaicSkeleton,
  OrderCardSkeleton,
  PDPDetailSkeleton,
  PeerOffersSkeleton,
  ProductGridSkeleton,
  RailSkeleton,
  ShopGridSkeleton,
} from "../skeletons"

describe("loading atoms prevail on every surface", () => {
  it("product grid shimmers tile and list variants", () => {
    const { unmount } = render(<ProductGridSkeleton count={4} view="grid" />)
    expect(screen.getByRole("status", { name: "Loading products" })).toBeInTheDocument()
    unmount()
    render(<ProductGridSkeleton count={2} view="list" />)
    expect(screen.getByRole("status", { name: "Loading products" })).toBeInTheDocument()
  })

  it("home proves mosaic shimmer", () => {
    render(<MosaicSkeleton />)
    expect(screen.getByRole("status", { name: "Loading categories" })).toBeInTheDocument()
  })

  it("chrome proves rail shimmer", () => {
    render(<RailSkeleton />)
    expect(screen.getByRole("status", { name: "Loading departments" })).toBeInTheDocument()
  })

  it("plp proves filter + grid shimmer", () => {
    render(
      <>
        <FilterSkeleton />
        <ProductGridSkeleton count={6} />
      </>,
    )
    expect(screen.getByRole("status", { name: "Loading filters" })).toBeInTheDocument()
    expect(screen.getByRole("status", { name: "Loading products" })).toBeInTheDocument()
  })

  it("pdp proves detail + peer-offers shimmer", () => {
    render(
      <>
        <PDPDetailSkeleton />
        <PeerOffersSkeleton />
      </>,
    )
    expect(screen.getByRole("status", { name: "Loading product" })).toBeInTheDocument()
    expect(screen.getByRole("status", { name: "Loading offers" })).toBeInTheDocument()
  })

  it("cart, shops, and orders prove their shimmers", () => {
    render(
      <>
        <CartSkeleton />
        <ShopGridSkeleton count={2} />
        <OrderCardSkeleton />
      </>,
    )
    expect(screen.getByRole("status", { name: "Loading cart" })).toBeInTheDocument()
    expect(screen.getByRole("status", { name: "Loading shops" })).toBeInTheDocument()
  })
})
