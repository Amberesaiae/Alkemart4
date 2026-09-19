import {
  addCartItem,
  createCart,
  createCheckout,
  getCatalog,
  getCategories,
  getProduct,
  getSellerShop,
  loginBuyer,
  registerBuyer,
  setBaseUrl,
} from "@alkemart/api-client"
import { getAlkemartApiUrl } from "./env"

export function ensureApiBaseUrl(): string {
  const url = getAlkemartApiUrl()
  if (url) setBaseUrl(url)
  return url
}

export async function workersJson<T>(path: string, init?: RequestInit): Promise<T> {
  const base = ensureApiBaseUrl()
  if (!base) throw new Error("VITE_ALKEMART_API_URL is not set")
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(init?.headers as Record<string, string> | undefined),
    },
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string }
  if (!res.ok) {
    throw Object.assign(new Error(data.error || data.message || `HTTP ${res.status}`), {
      status: res.status,
    })
  }
  return data
}

export {
  addCartItem,
  createCart,
  createCheckout,
  getCatalog,
  getCategories,
  getProduct,
  getSellerShop,
  loginBuyer,
  registerBuyer,
  setBaseUrl,
}
