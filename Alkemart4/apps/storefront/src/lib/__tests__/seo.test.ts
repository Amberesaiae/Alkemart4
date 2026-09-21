import { describe, expect, it } from "vitest"
import { productJsonLd } from "../seo"

const base = {
  id: "prod_1",
  title: "Tecno Spark 20",
  path: "/product/prod_1",
  amount: 2500,
  currencyCode: "ghs",
  sellerName: "Accra Phones",
} as const

describe("productJsonLd brand/seller honesty (blueprint Doc 08)", () => {
  it("never maps the seller into Brand", () => {
    const ld = productJsonLd({ ...base }) as { brand?: unknown }
    expect(ld.brand).toBeUndefined()
  })

  it("puts seller identity on the offer, not the product", () => {
    const ld = productJsonLd({ ...base }) as {
      offers?: { seller?: { name?: string } }
    }
    expect(ld.offers?.seller).toEqual({
      "@type": "Organization",
      name: "Accra Phones",
    })
  })

  it("emits true manufacturer brand only when known", () => {
    const withBrand = productJsonLd({ ...base, brandName: "Tecno" }) as {
      brand?: { name?: string }
    }
    expect(withBrand.brand).toEqual({ "@type": "Brand", name: "Tecno" })
  })

  it("omits offers block when price is unknown", () => {
    const ld = productJsonLd({
      id: "prod_2",
      title: "Mystery item",
      path: "/product/prod_2",
    }) as { offers?: unknown }
    expect(ld.offers).toBeUndefined()
  })
})
