/**
 * Address fields driven by operating-market locale profile.
 * Country selection is the driver; labels/options come from the market.
 */
import { FormField, FormSelect } from "@/components/form-field"
import type { OperatingMarket } from "@/lib/markets"

export type MarketAddressValues = {
  phone: string
  address_1: string
  address_2: string
  city: string
  province: string
  country_code: string
  postal_code: string
}

type Props = {
  markets: OperatingMarket[]
  values: MarketAddressValues
  onChange: (patch: Partial<MarketAddressValues>) => void
  /** Hide country selector (locked to single market) */
  lockCountry?: boolean
  error?: string
}

export function MarketAddressFields({
  markets,
  values,
  onChange,
  lockCountry,
  error,
}: Props) {
  const market =
    markets.find((m) => m.country_code === values.country_code) ?? markets[0]
  const locale = market?.locale
  const fields = locale?.address.fields ?? []

  // Always show country first as the driver when multiple markets exist
  const countryField = (
    <FormSelect
      label="Country"
      value={values.country_code}
      onChange={(v) => {
        const next = markets.find((m) => m.country_code === v)
        onChange({
          country_code: v,
          // Clear province when market changes (options differ)
          province: "",
        })
        void next
      }}
      required
      error={error}
    >
      {markets.map((m) => (
        <option key={m.country_code} value={m.country_code}>
          {m.display_name}
          {m.currency_code
            ? ` · ${m.currency_code.toUpperCase()}`
            : ""}
        </option>
      ))}
    </FormSelect>
  )

  if (!market) {
    return (
      <div className="space-y-3">
        {countryField}
        <p className="text-sm text-destructive">
          Delivery is not available for this country yet.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {!lockCountry || markets.length > 1 ? countryField : null}
      {markets.length === 1 && lockCountry ? (
        <p className="text-xs text-muted-foreground">
          Market: <strong>{market.display_name}</strong> · prices in{" "}
          <strong>{market.currency_code.toUpperCase()}</strong>
        </p>
      ) : null}

      {fields.map((f) => {
        if (f.key === "country_code") return null

        const value =
          f.key === "phone"
            ? values.phone
            : f.key === "address_1"
              ? values.address_1
              : f.key === "address_2"
                ? values.address_2
                : f.key === "city"
                  ? values.city
                  : f.key === "province"
                    ? values.province
                    : f.key === "postal_code"
                      ? values.postal_code
                      : ""

        const set = (v: string) => {
          if (f.key === "phone") onChange({ phone: v })
          else if (f.key === "address_1") onChange({ address_1: v })
          else if (f.key === "address_2") onChange({ address_2: v })
          else if (f.key === "city") onChange({ city: v })
          else if (f.key === "province") onChange({ province: v })
          else if (f.key === "postal_code") onChange({ postal_code: v })
        }

        if (f.input === "select" && f.options?.length) {
          return (
            <FormSelect
              key={f.key}
              label={f.label}
              value={value}
              onChange={set}
              required={f.required}
            >
              <option value="">
                {f.required ? "Select…" : "Optional…"}
              </option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </FormSelect>
          )
        }

        return (
          <div key={f.key} className="space-y-1">
            <FormField
              label={f.label}
              value={value}
              onChange={set}
              type={f.input === "tel" ? "tel" : "text"}
              inputMode={f.input === "tel" ? "tel" : undefined}
              required={f.required}
              placeholder={f.placeholder}
            />
            {f.hint ? (
              <p className="text-xs text-muted-foreground">{f.hint}</p>
            ) : null}
          </div>
        )
      })}

      {locale?.address.help ? (
        <p className="text-xs text-muted-foreground">{locale.address.help}</p>
      ) : null}
      {locale?.phone.hint && !fields.some((f) => f.key === "phone" && f.hint) ? (
        <p className="text-xs text-muted-foreground">{locale.phone.hint}</p>
      ) : null}
      <p className="text-[11px] text-muted-foreground">
        Currency for this market:{" "}
        <strong>{market.currency_code.toUpperCase()}</strong>
        {locale?.payments.preferred?.length ? (
          <>
            {" "}
            · Payments: {locale.payments.preferred.join(", ").replace(/_/g, " ")}
          </>
        ) : null}
      </p>
    </div>
  )
}
