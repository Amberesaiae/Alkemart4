import {
  assertCanSell,
  buildSellerReadiness,
  type SellerChecklist,
  type SellerSnapshot,
} from "../seller-readiness"

const complete: SellerChecklist = {
  profile: true,
  stock_location: true,
  sales_channel_link: true,
  shipping_profile: true,
  gh_shipping_option: true,
}

const incomplete: SellerChecklist = {
  ...complete,
  stock_location: false,
}

function readiness(
  status: string,
  checklist: SellerChecklist,
  approved = true,
) {
  const seller: SellerSnapshot = {
    id: "sel_1",
    status,
    approved_at: approved ? "2026-07-01T00:00:00.000Z" : null,
    name: "Shop",
    handle: "shop",
    email: "s@x.com",
    currency_code: "ghs",
    address: { address_1: "A", city: "Accra", country_code: "gh" },
  }
  return buildSellerReadiness(seller, checklist)
}

describe("assertCanSell flag matrix", () => {
  const prev = process.env.ALKEMART_STRICT_PROPOSE_GATES

  afterEach(() => {
    if (prev === undefined) delete process.env.ALKEMART_STRICT_PROPOSE_GATES
    else process.env.ALKEMART_STRICT_PROPOSE_GATES = prev
  })

  it("blocks pending_approval for propose and offer", () => {
    const r = readiness("pending_approval", complete, false)
    expect(() => assertCanSell(r, "propose")).toThrow(/awaiting approval/i)
    expect(() => assertCanSell(r, "offer")).toThrow(/awaiting approval/i)
  })

  it("blocks rejected application (suspended without approved_at)", () => {
    const r = readiness("suspended", complete, false)
    expect(() => assertCanSell(r, "propose")).toThrow(/not approved|suspended/i)
  })

  it("blocks terminated", () => {
    const r = readiness("terminated", complete)
    expect(() => assertCanSell(r, "offer")).toThrow(/terminated/i)
  })

  it("strict propose blocks incomplete setup", () => {
    process.env.ALKEMART_STRICT_PROPOSE_GATES = "true"
    const r = readiness("open", incomplete)
    expect(() => assertCanSell(r, "propose")).toThrow()
    expect(() => assertCanSell(r, "offer")).toThrow()
  })

  it("non-strict propose allows open incomplete setup; offer still blocked", () => {
    process.env.ALKEMART_STRICT_PROPOSE_GATES = "false"
    const r = readiness("open", incomplete)
    // can_propose still false on readiness object but assertCanSell propose only checks open when not strict
    expect(() => assertCanSell(r, "propose")).not.toThrow()
    expect(() => assertCanSell(r, "offer")).toThrow()
  })

  it("allows active seller for propose and offer", () => {
    process.env.ALKEMART_STRICT_PROPOSE_GATES = "true"
    const r = readiness("open", complete)
    expect(r.phase).toBe("active")
    expect(() => assertCanSell(r, "propose")).not.toThrow()
    expect(() => assertCanSell(r, "offer")).not.toThrow()
  })
})
