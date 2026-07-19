import {
  buildCatalogCacheKey,
  catalogCacheTtlSec,
  _resetCatalogCacheClientForTests,
} from "../catalog-cache"

describe("catalog-cache pure helpers", () => {
  afterEach(() => {
    delete process.env.CATALOG_CACHE_TTL_SEC
    delete process.env.CATALOG_CACHE_DISABLED
    _resetCatalogCacheClientForTests()
  })

  it("builds stable keys with normalized handles", () => {
    expect(
      buildCatalogCacheKey({
        gen: 3,
        sellerHandle: "AmberStone",
        categoryHandle: "",
        limit: 24,
        offset: 0,
      }),
    ).toBe("alkemart:catalog:v1:g3:s=amberstone:c=_:l=24:o=0")
  })

  it("clamps TTL to 15–300", () => {
    process.env.CATALOG_CACHE_TTL_SEC = "5"
    expect(catalogCacheTtlSec()).toBe(15)
    process.env.CATALOG_CACHE_TTL_SEC = "999"
    expect(catalogCacheTtlSec()).toBe(300)
    process.env.CATALOG_CACHE_TTL_SEC = "90"
    expect(catalogCacheTtlSec()).toBe(90)
  })
})
