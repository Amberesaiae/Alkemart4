/**
 * Operating markets from the backend — country is the form driver.
 * Admin enables countries via Regions; this client consumes the result.
 * Workers path: static Ghana market until /store/markets exists on the API.
 */
import { GHANA_REGIONS } from "@alkemart/shared/ghana"
import { commerceContext, getMedusaClient } from "./medusa"
import { getAlkemartApiUrl, getBackendUrl, getPublishableKey } from "./env"

function ghanaWorkersMarket(): MarketsResponse {
  const regionOptions = GHANA_REGIONS.map((r) => ({
    value: r.name,
    label: r.name,
  }))
  const locale: MarketLocale = {
    country_code: "gh",
    display_name: "Ghana",
    default_currency_code: "ghs",
    currency_symbol: "₵",
    phone: {
      country_calling_code: "+233",
      example: "0241234567",
      hint: "Ghana mobile number",
    },
    address: {
      fields: [
        {
          key: "address_1",
          label: "Street / area",
          required: true,
          placeholder: "Near Circle, Accra",
        },
        {
          key: "address_2",
          label: "Landmark",
          required: false,
          placeholder: "Opposite the filling station",
        },
        { key: "city", label: "City / town", required: true, placeholder: "Accra" },
        {
          key: "province",
          label: "Region",
          required: true,
          input: "select",
          options: regionOptions,
        },
        {
          key: "postal_code",
          label: "GhanaPostGPS (optional)",
          required: false,
          placeholder: "GA-123-4567",
        },
      ],
      help: "Delivery fees are set per seller on the Workers quote.",
    },
    payments: { preferred: ["cod", "momo", "card"] },
    shipping: { hint: "Seller delivery or pickup — confirmed at order time." },
  }
  const market: OperatingMarket = {
    region_id: "gh",
    region_name: "Ghana",
    currency_code: "ghs",
    country_code: "gh",
    display_name: "Ghana",
    locale,
  }
  return {
    markets: [market],
    default_country_code: "gh",
    default_region_id: "gh",
    default_currency_code: "ghs",
  }
}

export type AddressFieldSpec = {
  key: string
  label: string
  required: boolean
  placeholder?: string
  hint?: string
  input?: "text" | "tel" | "select"
  options?: { value: string; label: string }[]
}

export type MarketLocale = {
  country_code: string
  display_name: string
  default_currency_code: string
  currency_symbol: string
  phone: {
    country_calling_code: string
    example: string
    hint: string
  }
  address: {
    fields: AddressFieldSpec[]
    help?: string
  }
  payments: { preferred: string[] }
  shipping: { hint: string }
}

export type OperatingMarket = {
  region_id: string
  region_name: string
  currency_code: string
  country_code: string
  display_name: string
  locale: MarketLocale
}

export type MarketsResponse = {
  markets: OperatingMarket[]
  default_country_code: string | null
  default_region_id: string | null
  default_currency_code: string | null
}

export async function listOperatingMarkets(): Promise<MarketsResponse> {
  if (getAlkemartApiUrl()) {
    return ghanaWorkersMarket()
  }

  const sdk = getMedusaClient()
  // Prefer dedicated alkemart markets route (country → locale).
  try {
    const res = await fetch(`${getBackendUrl()}/store/alkemart/markets`, {
      headers: {
        Accept: "application/json",
        "x-publishable-api-key": getPublishableKey(),
      },
    })
    if (res.ok) {
      return (await res.json()) as MarketsResponse
    }
  } catch {
    /* fall through */
  }

  // Fallback: region countries only (no rich locale until markets route is live).
  const { regionId } = commerceContext()
  const { region } = await sdk.store.region.retrieve(regionId)
  const r = region as {
    id?: string
    name?: string
    currency_code?: string
    countries?: { iso_2?: string; name?: string }[]
  }
  const currency = (r.currency_code || "ghs").toLowerCase()
  const markets: OperatingMarket[] = (r.countries || [])
    .map((c) => {
      const cc = (c.iso_2 || "").toLowerCase()
      if (!cc) return null
      return {
        region_id: r.id || regionId,
        region_name: r.name || "",
        currency_code: currency,
        country_code: cc,
        display_name: c.name || cc.toUpperCase(),
        locale: {
          country_code: cc,
          display_name: c.name || cc.toUpperCase(),
          default_currency_code: currency,
          currency_symbol: currency.toUpperCase(),
          phone: { country_calling_code: "", example: "", hint: "" },
          address: { fields: [] },
          payments: { preferred: [] },
          shipping: { hint: "" },
        },
      } satisfies OperatingMarket
    })
    .filter(Boolean) as OperatingMarket[]

  return {
    markets,
    default_country_code: markets[0]?.country_code ?? null,
    default_region_id: markets[0]?.region_id ?? regionId,
    default_currency_code: markets[0]?.currency_code ?? currency,
  }
}

export function marketForCountry(
  markets: OperatingMarket[],
  countryCode: string,
): OperatingMarket | undefined {
  return markets.find(
    (m) => m.country_code === countryCode.trim().toLowerCase(),
  )
}
