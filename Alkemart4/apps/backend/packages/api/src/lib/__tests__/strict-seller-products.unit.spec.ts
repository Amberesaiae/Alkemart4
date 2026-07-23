import {
  EXCLUSIVE_PRODUCT_NONE_ID,
  buildExclusiveProductFilter,
} from "../../api/middlewares/strict-seller-products"

describe("buildExclusiveProductFilter", () => {
  it("scopes to owned ids and drops Mercur shared-catalog $or/$and", () => {
    const prev = {
      $and: [
        {
          $or: [
            { id: ["prod_own"] },
            { status: "published", id: { $nin: ["prod_other"] } },
          ],
        },
      ],
      status: "draft",
      q: "rice",
    }
    const next = buildExclusiveProductFilter(["prod_a", "prod_b"], prev)
    expect(next.id).toEqual(["prod_a", "prod_b"])
    expect(next.status).toBe("draft")
    expect(next.q).toBe("rice")
    expect(next.$and).toBeUndefined()
    expect(next.$or).toBeUndefined()
  })

  it("uses sentinel when seller owns nothing (fail closed)", () => {
    const next = buildExclusiveProductFilter([], { $or: [{ status: "published" }] })
    expect(next.id).toEqual([EXCLUSIVE_PRODUCT_NONE_ID])
    expect(next.$or).toBeUndefined()
  })

  it("never returns empty id array", () => {
    const next = buildExclusiveProductFilter([])
    expect(Array.isArray(next.id)).toBe(true)
    expect((next.id as string[]).length).toBe(1)
  })
})
