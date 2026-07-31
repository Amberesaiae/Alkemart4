import {
  isCountryOperating,
  requireOperatingMarket,
  normalizePhoneForCountry,
  marketByCountry,
  type OperatingMarket,
} from "../operating-markets"

const ghana: OperatingMarket = {
  id: "mrk_gh",
  country_code: "gh",
  currency_code: "ghs",
  display_name: "Ghana",
  regions: [{ id: "reg_gh", name: "Ghana" }],
}

const nigeria: OperatingMarket = {
  id: "mrk_ng",
  country_code: "ng",
  currency_code: "ngn",
  display_name: "Nigeria",
  regions: [{ id: "reg_ng", name: "Nigeria" }],
}

const markets = [ghana, nigeria]

describe("marketByCountry", () => {
  it("finds by lowercase country code", () => {
    expect(marketByCountry(markets, "gh")).toEqual(ghana)
  })

  it("finds by uppercase country code", () => {
    expect(marketByCountry(markets, "NG")).toEqual(nigeria)
  })

  it("returns undefined for unknown country", () => {
    expect(marketByCountry(markets, "ke")).toBeUndefined()
  })
})

describe("isCountryOperating", () => {
  it("returns true for operating country", () => {
    expect(isCountryOperating(markets, "gh")).toBe(true)
  })

  it("returns false for non-operating country", () => {
    expect(isCountryOperating(markets, "ke")).toBe(false)
  })

  it("returns false for empty markets", () => {
    expect(isCountryOperating([], "gh")).toBe(false)
  })
})

describe("requireOperatingMarket", () => {
  it("returns market for operating country", () => {
    expect(requireOperatingMarket(markets, "gh")).toEqual(ghana)
  })

  it("throws for non-operating country", () => {
    expect(() => requireOperatingMarket(markets, "ke")).toThrow(
      /not in operation/i,
    )
  })

  it("throws for empty markets", () => {
    expect(() => requireOperatingMarket([], "gh")).toThrow(/not in operation/i)
  })
})

describe("normalizePhoneForCountry", () => {
  describe("Ghana (gh)", () => {
    it("converts 024... to +233...", () => {
      expect(normalizePhoneForCountry("gh", "0241234567")).toBe("+233241234567")
    })

    it("passes through +233...", () => {
      expect(normalizePhoneForCountry("gh", "+233241234567")).toBe(
        "+233241234567",
      )
    })

    it("converts 9-digit to +233...", () => {
      expect(normalizePhoneForCountry("gh", "241234567")).toBe("+233241234567")
    })

    it("rejects invalid Ghana number", () => {
      expect(() => normalizePhoneForCountry("gh", "123")).toThrow(
        /valid mobile/i,
      )
    })

    it("throws on empty phone", () => {
      expect(() => normalizePhoneForCountry("gh", "")).toThrow(
        /phone is required/i,
      )
    })
  })

  describe("non-Ghana", () => {
    it("normalizes with leading +", () => {
      expect(normalizePhoneForCountry("ng", "+234801234567")).toBe(
        "+234801234567",
      )
    })

    it("adds + to digits >= 10", () => {
      expect(normalizePhoneForCountry("ng", "234801234567")).toBe(
        "+234801234567",
      )
    })

    it("throws for short number without +", () => {
      expect(() => normalizePhoneForCountry("ng", "123")).toThrow(
        /valid phone/i,
      )
    })
  })
})
