export function getApiUrl(): string {
  if (import.meta.env.PROD) return "/api"
  const raw = (import.meta.env.VITE_ALKEMART_API_URL as string | undefined)?.trim()
  if (!raw) throw new Error("VITE_ALKEMART_API_URL is not set — see .env.template")
  return raw.replace(/\/$/, "")
}

export function getStorefrontUrl(): string {
  return ((import.meta.env.VITE_STOREFRONT_URL as string | undefined) ?? "").replace(/\/$/, "")
}
