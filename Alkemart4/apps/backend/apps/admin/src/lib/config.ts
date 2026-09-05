const currencySymbol = import.meta.env.VITE_CURRENCY_SYMBOL || "₵"

/** True when the SPA is pointed at the Workers API (Cloudflare Pages cut). */
export const isWorkersApi = Boolean(
  (import.meta.env.VITE_ALKEMART_API_URL as string | undefined)?.trim(),
)

/** Default landing route after login / root redirect. */
export const homePath = isWorkersApi ? "/sellers" : "/analytics"

export { currencySymbol }
