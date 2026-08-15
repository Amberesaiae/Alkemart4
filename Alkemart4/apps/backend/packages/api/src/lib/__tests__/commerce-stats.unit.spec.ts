import { topProductsFromOrders } from "../commerce-stats"

describe("topProductsFromOrders", () => {
  it("rolls up units and gmv per product title across orders", () => {
    const rows = [
      {
        status: "completed",
        items: [
          { title: "Palm Oil 1L", quantity: 2, unit_price: 55 },
          { title: "Tea 200g", quantity: 1, unit_price: 30 },
        ],
      },
      {
        status: "completed",
        items: [{ title: "Palm Oil 1L", quantity: 1, unit_price: 55 }],
      },
    ]
    const top = topProductsFromOrders(rows)
    expect(top[0]).toMatchObject({ title: "Palm Oil 1L", units: 3, gmv: 165 })
    expect(top[1]).toMatchObject({ title: "Tea 200g", units: 1, gmv: 30 })
  })

  it("excludes cancelled orders", () => {
    const rows = [
      { status: "cancelled", items: [{ title: "Fridge", quantity: 5, unit_price: 100 }] },
      { status: "completed", items: [{ title: "Fridge", quantity: 1, unit_price: 100 }] },
    ]
    const top = topProductsFromOrders(rows)
    expect(top[0].units).toBe(1)
    expect(top).toHaveLength(1)
  })

  it("derives unit price from subtotal when unit_price missing", () => {
    const rows = [
      {
        status: "completed",
        items: [{ title: "Rice 5kg", quantity: 4, subtotal: 400 }],
      },
    ]
    const top = topProductsFromOrders(rows)
    expect(top[0].gmv).toBe(400)
  })

  it("respects limit", () => {
    const rows = [
      {
        status: "completed",
        items: [
          { title: "A", quantity: 1, unit_price: 1 },
          { title: "B", quantity: 1, unit_price: 1 },
          { title: "C", quantity: 1, unit_price: 1 },
        ],
      },
    ]
    expect(topProductsFromOrders(rows, { limit: 2 })).toHaveLength(2)
  })

  it("skips items with zero quantity", () => {
    const rows = [
      {
        status: "completed",
        items: [
          { title: "A", quantity: 0, unit_price: 5 },
          { title: "B", quantity: 2, unit_price: 5 },
        ],
      },
    ]
    const top = topProductsFromOrders(rows)
    expect(top.map((t) => t.title)).toEqual(["B"])
  })
})
