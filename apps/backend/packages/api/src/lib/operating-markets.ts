/**
 * Operating markets — canonical country-gated config for alkemart.
 *
 * Product model (not seed):
 *   Admin enables countries via Medusa Regions (currency + countries on region).
 *   Those countries are "in operation". Everything else derives:
 *     country → currency, address profile, phone rules, payment hints.
 *
 * ACID / consistency:
 *   - Region rows in Postgres are the transactional SoR for "what can sell where".
 *   - Cart/order currency follows the region (Medusa already enforces this).
 *   - Locale profiles are pure config (no second DB of truth for money geography).
 *   - Seed scripts may bootstrap a first region; they are not the runtime model.
 *
 * Multi-country later: add a profile + enable country on a region in Admin.
 * No mass rewrite of forms — they already bind to market profiles.
 */

export type AddressField =
  | "phone"
  | "address_1"
  | "address_2"
  | "city"
  | "province"
  | "country_code"
  | "postal_code"

export type AddressFieldSpec = {
  key: AddressField
  label: string
  required: boolean
  placeholder?: string
  hint?: string
  /** UI widget hint */
  input?: "text" | "tel" | "select"
  /** For select fields — static options when known (e.g. Ghana regions) */
  options?: { value: string; label: string }[]
}

export type CountryLocaleProfile = {
  /** ISO 3166-1 alpha-2 lower */
  country_code: string
  display_name: string
  /** ISO 4217 lower — must match the region currency when this country is active */
  default_currency_code: string
  currency_symbol: string
  phone: {
    country_calling_code: string
    example: string
    hint: string
  }
  address: {
    fields: AddressFieldSpec[]
    /** Free-text tip under the form */
    help?: string
  }
  payments: {
    /** Labels only — actual providers still come from region payment config */
    preferred: string[]
  }
  shipping: {
    hint: string
  }
}

/** Profiles we know how to operate. Unknown countries get a safe generic profile. */
export const COUNTRY_PROFILES: Record<string, CountryLocaleProfile> = {
  gh: {
    country_code: "gh",
    display_name: "Ghana",
    default_currency_code: "ghs",
    currency_symbol: "GH₵",
    phone: {
      country_calling_code: "+233",
      example: "024 123 4567",
      hint: "Ghana mobile for delivery & MoMo (MTN, Telecel, AT)",
    },
    address: {
      help: "Use a rider-friendly address. GhanaPostGPS is optional for COD.",
      fields: [
        {
          key: "phone",
          label: "Mobile number",
          required: true,
          input: "tel",
          placeholder: "024 123 4567",
          hint: "024… or +23324…",
        },
        {
          key: "address_1",
          label: "Street / house / area",
          required: true,
          placeholder: "House number, street, neighbourhood",
        },
        {
          key: "address_2",
          label: "Landmark / directions",
          required: false,
          placeholder: "Near Goil station, blue gate…",
        },
        {
          key: "city",
          label: "City / town",
          required: true,
          placeholder: "e.g. Accra, Kumasi, Tema",
        },
        {
          key: "province",
          label: "Region",
          required: false,
          input: "select",
          options: [
            "Ahafo",
            "Ashanti",
            "Bono",
            "Bono East",
            "Central",
            "Eastern",
            "Greater Accra",
            "North East",
            "Northern",
            "Oti",
            "Savannah",
            "Upper East",
            "Upper West",
            "Volta",
            "Western",
            "Western North",
          ].map((r) => ({ value: r, label: r })),
        },
        {
          key: "country_code",
          label: "Country",
          required: true,
          input: "select",
        },
        {
          key: "postal_code",
          label: "GhanaPostGPS (optional)",
          required: false,
          placeholder: "e.g. GA-184-1234",
          hint: "Digital address — not a UK/US postcode",
        },
      ],
    },
    payments: {
      preferred: ["cash_on_delivery", "mobile_money"],
    },
    shipping: {
      hint: "Courier within city · bus parcel / courier nationwide",
    },
  },
}

export function genericProfile(
  countryCode: string,
  currencyCode: string,
): CountryLocaleProfile {
  const cc = countryCode.toLowerCase()
  return {
    country_code: cc,
    display_name: cc.toUpperCase(),
    default_currency_code: currencyCode.toLowerCase(),
    currency_symbol: currencyCode.toUpperCase(),
    phone: {
      country_calling_code: "",
      example: "",
      hint: "Include country calling code",
    },
    address: {
      fields: [
        { key: "phone", label: "Phone", required: true, input: "tel" },
        { key: "address_1", label: "Address line 1", required: true },
        { key: "address_2", label: "Address line 2", required: false },
        { key: "city", label: "City", required: true },
        { key: "province", label: "State / province / region", required: false },
        { key: "country_code", label: "Country", required: true, input: "select" },
        { key: "postal_code", label: "Postal code", required: false },
      ],
    },
    payments: { preferred: ["cash_on_delivery"] },
    shipping: { hint: "Configure shipping for this market in Admin" },
  }
}

export function profileForCountry(
  countryCode: string,
  regionCurrency: string,
): CountryLocaleProfile {
  const cc = countryCode.toLowerCase()
  const known = COUNTRY_PROFILES[cc]
  if (known) {
    // Currency on the *region* wins when admin configured it (SoR for money).
    return {
      ...known,
      default_currency_code: (regionCurrency || known.default_currency_code).toLowerCase(),
    }
  }
  return genericProfile(cc, regionCurrency || "usd")
}

export type OperatingMarket = {
  /** Region id — Medusa commerce scope for this market */
  region_id: string
  region_name: string
  currency_code: string
  country_code: string
  display_name: string
  /** Full locale profile for forms (address, phone, payments hints) */
  locale: CountryLocaleProfile
}

type QueryService = {
  graph: (args: unknown) => Promise<{ data: unknown }>
}

function asList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (data && typeof data === "object") return [data as Record<string, unknown>]
  return []
}

/**
 * Build operating markets from Medusa regions (admin-gated countries in operation).
 * Only countries attached to a region appear — that is the foundation gate.
 */
export async function listOperatingMarkets(
  query: QueryService,
): Promise<OperatingMarket[]> {
  let regions: Record<string, unknown>[] = []
  try {
    const { data } = await query.graph({
      entity: "region",
      fields: ["id", "name", "currency_code", "countries.iso_2", "countries.name", "countries.display_name"],
      filters: {},
    })
    regions = asList(data)
  } catch {
    try {
      const { data } = await query.graph({
        entity: "region",
        fields: ["id", "name", "currency_code", "countries.iso_2", "countries.name"],
        filters: {},
      })
      regions = asList(data)
    } catch {
      return []
    }
  }

  const markets: OperatingMarket[] = []
  for (const r of regions) {
    const regionId = String(r.id ?? "")
    const regionName = String(r.name ?? "")
    const currency = String(r.currency_code ?? "").toLowerCase()
    const countries = asList(r.countries)
    for (const c of countries) {
      const iso = String(c.iso_2 ?? c.iso2 ?? "").toLowerCase()
      if (!iso || !regionId) continue
      const display =
        String(c.display_name ?? c.name ?? "").trim() ||
        profileForCountry(iso, currency).display_name
      const locale = profileForCountry(iso, currency)
      markets.push({
        region_id: regionId,
        region_name: regionName,
        currency_code: currency || locale.default_currency_code,
        country_code: iso,
        display_name: display || locale.display_name,
        locale: {
          ...locale,
          display_name: display || locale.display_name,
        },
      })
    }
  }

  // Stable order: Ghana first if present, then alpha
  markets.sort((a, b) => {
    if (a.country_code === "gh") return -1
    if (b.country_code === "gh") return 1
    return a.display_name.localeCompare(b.display_name)
  })

  return markets
}

export function marketByCountry(
  markets: OperatingMarket[],
  countryCode: string,
): OperatingMarket | undefined {
  const cc = countryCode.toLowerCase()
  return markets.find((m) => m.country_code === cc)
}

/**
 * Normalize phone for an operating country.
 * Ghana (gh): 024… / 9 digits / +233… → E.164 +233…
 * Other: require leading + or return digits-as-plus if long enough.
 */
export function normalizePhoneForCountry(
  countryCode: string,
  phone: string,
): string {
  const cc = countryCode.toLowerCase()
  const trimmed = phone.trim()
  if (!trimmed) {
    throw new Error("Phone is required")
  }
  const digits = trimmed.replace(/\D/g, "")

  if (cc === "gh") {
    if (digits.startsWith("233") && digits.length >= 12) return `+${digits}`
    if (digits.startsWith("0") && digits.length === 10) {
      return `+233${digits.slice(1)}`
    }
    if (digits.length === 9) return `+233${digits}`
    if (trimmed.startsWith("+") && digits.length >= 10) return `+${digits}`
    throw new Error(
      "Enter a valid Ghana mobile (e.g. 024… or +23324…)",
    )
  }

  if (trimmed.startsWith("+") && digits.length >= 10) return `+${digits}`
  if (digits.length >= 10) return `+${digits}`
  throw new Error("Enter a valid phone number with country code")
}

/** True if country is among operating markets. */
export function isCountryOperating(
  markets: OperatingMarket[],
  countryCode: string,
): boolean {
  return Boolean(marketByCountry(markets, countryCode))
}

/**
 * Resolve market for checkout/onboarding or throw if country not gated on.
 */
export function requireOperatingMarket(
  markets: OperatingMarket[],
  countryCode: string,
): OperatingMarket {
  const m = marketByCountry(markets, countryCode)
  if (!m) {
    throw new Error(
      `Country "${countryCode}" is not in operation. Enable it under Admin → Regions.`,
    )
  }
  return m
}
