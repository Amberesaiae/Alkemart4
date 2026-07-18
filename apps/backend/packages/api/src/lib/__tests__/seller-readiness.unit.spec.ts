import {
  buildSellerReadiness,
  deriveSellerPhase,
  evaluateProfileChecklist,
  isChecklistComplete,
  nextActionFor,
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
  gh_shipping_option: false,
}

describe("deriveSellerPhase", () => {
  it("maps pending_approval", () => {
    expect(deriveSellerPhase("pending_approval", null, false)).toBe(
      "pending_approval",
    )
  })

  it("maps suspended without approved_at to rejected", () => {
    expect(deriveSellerPhase("suspended", null, false)).toBe("rejected")
  })

  it("maps suspended with approved_at to suspended", () => {
    expect(
      deriveSellerPhase("suspended", "2026-07-01T00:00:00.000Z", true),
    ).toBe("suspended")
  })

  it("maps open + incomplete checklist to setup_incomplete", () => {
    expect(deriveSellerPhase("open", "2026-07-01T00:00:00.000Z", false)).toBe(
      "setup_incomplete",
    )
  })

  it("maps open + complete checklist to active", () => {
    expect(deriveSellerPhase("open", "2026-07-01T00:00:00.000Z", true)).toBe(
      "active",
    )
  })

  it("maps terminated", () => {
    expect(deriveSellerPhase("terminated", "2026-07-01T00:00:00.000Z", true)).toBe(
      "terminated",
    )
  })
})

describe("evaluateProfileChecklist", () => {
  it("requires ghana-ish address + identity", () => {
    const seller: SellerSnapshot = {
      id: "sel_1",
      name: "Tema Fresh",
      handle: "tema-fresh",
      email: "a@b.com",
      currency_code: "ghs",
      address: {
        address_1: "Community 1",
        city: "Tema",
        country_code: "gh",
      },
    }
    expect(evaluateProfileChecklist(seller)).toBe(true)
    expect(evaluateProfileChecklist({ ...seller, name: "" })).toBe(false)
    expect(
      evaluateProfileChecklist({
        ...seller,
        address: { ...seller.address!, city: "" },
      }),
    ).toBe(false)
  })
})

describe("buildSellerReadiness", () => {
  const base: SellerSnapshot = {
    id: "sel_1",
    status: "open",
    approved_at: "2026-07-16T00:00:00.000Z",
    name: "Tema",
    handle: "tema",
    email: "t@x.com",
    currency_code: "ghs",
    address: { address_1: "A", city: "Tema", country_code: "gh" },
  }

  it("active when open + complete checklist", () => {
    const r = buildSellerReadiness(base, complete)
    expect(r.phase).toBe("active")
    expect(r.setup_complete).toBe(true)
    expect(r.can_propose_products).toBe(true)
    expect(r.can_create_offers).toBe(true)
    expect(r.poll_after_seconds).toBe(0)
  })

  it("setup_incomplete points at missing shipping", () => {
    const r = buildSellerReadiness(base, incomplete)
    expect(r.phase).toBe("setup_incomplete")
    expect(r.can_create_offers).toBe(false)
    expect(r.next_action?.code).toBe("add_gh_shipping")
    expect(r.poll_after_seconds).toBe(20)
  })

  it("rejected application cannot sell", () => {
    const r = buildSellerReadiness(
      { ...base, status: "suspended", approved_at: null },
      complete,
    )
    expect(r.phase).toBe("rejected")
    expect(r.can_propose_products).toBe(false)
    expect(r.next_action?.code).toBe("fix_application")
  })
})

describe("isChecklistComplete / nextActionFor", () => {
  it("requires all five checks", () => {
    expect(isChecklistComplete(complete)).toBe(true)
    expect(isChecklistComplete(incomplete)).toBe(false)
  })

  it("pending waits for approval", () => {
    expect(nextActionFor("pending_approval", incomplete)?.code).toBe(
      "wait_approval",
    )
  })
})
