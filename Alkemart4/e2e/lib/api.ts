/**
 * Real HTTP helpers against the live Medusa/Mercur API.
 * Uses emailpass — same contracts the panels and storefront use.
 */

import { API } from "./env"
import fs from "node:fs"
import path from "node:path"

export type TokenBundle = {
  token: string
  actorType: "user" | "member" | "customer"
}

async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; json: any; text: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...headers },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    /* non-json */
  }
  return { status: res.status, json, text }
}

export async function getJson(
  url: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; json: any }> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", ...headers },
  })
  const text = await res.text()
  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    /* */
  }
  return { status: res.status, json }
}

/** Admin / ops actor */
export async function loginAdmin(
  email: string,
  password: string,
): Promise<TokenBundle> {
  const { status, json, text } = await postJson(`${API}/auth/user/emailpass`, {
    email,
    password,
  })
  if (status >= 400 || !json?.token) {
    throw new Error(`Admin login failed (${status}): ${text.slice(0, 200)}`)
  }
  return { token: json.token as string, actorType: "user" }
}

/** Seller / member actor */
export async function loginSeller(
  email: string,
  password: string,
): Promise<TokenBundle> {
  const { status, json, text } = await postJson(
    `${API}/auth/member/emailpass`,
    { email, password },
  )
  if (status >= 400 || !json?.token) {
    throw new Error(`Seller login failed (${status}): ${text.slice(0, 200)}`)
  }
  return { token: json.token as string, actorType: "member" }
}

/** Buyer — register then login with a unique real email (not a seed script) */
export async function registerAndLoginBuyer(opts: {
  email: string
  password: string
  firstName?: string
  lastName?: string
}): Promise<TokenBundle> {
  await postJson(`${API}/auth/customer/emailpass/register`, {
    email: opts.email,
    password: opts.password,
  })
  // Create customer profile if required
  const login = await postJson(`${API}/auth/customer/emailpass`, {
    email: opts.email,
    password: opts.password,
  })
  if (login.status >= 400 || !login.json?.token) {
    throw new Error(
      `Buyer login failed (${login.status}): ${login.text.slice(0, 200)}`,
    )
  }
  const token = login.json.token as string
  // Best-effort customer create (idempotent-ish)
  await postJson(
    `${API}/store/customers`,
    {
      email: opts.email,
      first_name: opts.firstName ?? "Live",
      last_name: opts.lastName ?? "Buyer",
    },
    { Authorization: `Bearer ${token}` },
  )
  return { token, actorType: "customer" }
}

export async function listSellerStores(memberToken: string) {
  const { status, json } = await getJson(`${API}/vendor/sellers`, {
    Authorization: `Bearer ${memberToken}`,
  })
  // Mercur returns membership rows: { seller_members: [{ seller_id, seller: { id, name } }] }
  const fromMembers = Array.isArray(json?.seller_members)
    ? (json.seller_members as { seller?: { id?: string; name?: string }; seller_id?: string }[])
        .map((m) => m.seller ?? (m.seller_id ? { id: m.seller_id } : null))
        .filter(Boolean)
    : []
  const sellers =
    fromMembers.length > 0
      ? fromMembers
      : json?.sellers ?? (json?.seller ? [json.seller] : [])
  return { status, sellers: sellers as { id?: string; name?: string }[], raw: json }
}

export async function getOnboarding(memberToken: string, sellerId: string) {
  return getJson(`${API}/vendor/alkemart/onboarding/status`, {
    Authorization: `Bearer ${memberToken}`,
    "x-seller-id": sellerId,
  })
}

export async function getModerationSummary(adminToken: string) {
  return getJson(`${API}/admin/alkemart/moderation/summary`, {
    Authorization: `Bearer ${adminToken}`,
  })
}

export async function getCatalog(pk: string, limit = 8) {
  return getJson(`${API}/store/alkemart/catalog?limit=${limit}`, {
    "x-publishable-api-key": pk,
  })
}

/** Upload a real image file via vendor uploads (live media path) */
export async function uploadVendorImage(opts: {
  memberToken: string
  sellerId: string
  filePath: string
}): Promise<{ status: number; files: any[]; text: string }> {
  const buf = fs.readFileSync(opts.filePath)
  const name = path.basename(opts.filePath)
  const form = new FormData()
  form.append(
    "files",
    new Blob([buf], { type: "image/png" }),
    name,
  )
  const res = await fetch(`${API}/vendor/uploads`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.memberToken}`,
      "x-seller-id": opts.sellerId,
    },
    body: form,
  })
  const text = await res.text()
  let json: any = null
  try {
    json = JSON.parse(text)
  } catch {
    /* */
  }
  return {
    status: res.status,
    files: json?.files ?? json?.uploads ?? [],
    text,
  }
}

/** List products visible to a seller (isolation-sensitive). */
export async function listVendorProducts(opts: {
  memberToken: string
  sellerId: string
  limit?: number
}): Promise<{
  status: number
  products: { id?: string; title?: string; status?: string }[]
  count: number
  json: any
}> {
  const limit = opts.limit ?? 50
  const { status, json } = await getJson(
    `${API}/vendor/products?limit=${limit}&fields=id,title,status,handle`,
    {
      Authorization: `Bearer ${opts.memberToken}`,
      "x-seller-id": opts.sellerId,
    },
  )
  const products = Array.isArray(json?.products) ? json.products : []
  return {
    status,
    products,
    count: typeof json?.count === "number" ? json.count : products.length,
    json,
  }
}

export async function createVendorProduct(opts: {
  memberToken: string
  sellerId: string
  title: string
  description: string
  thumbnail?: string
}): Promise<{ status: number; product?: any; text: string }> {
  // Mercur product create shapes vary; try common vendor payload
  const body = {
    title: opts.title,
    description: opts.description,
    status: "proposed",
    options: [{ title: "Default", values: ["One"] }],
    variants: [
      {
        title: "Default",
        options: { Default: "One" },
        prices: [{ amount: 45, currency_code: "ghs" }],
        manage_inventory: false,
      },
    ],
    ...(opts.thumbnail
      ? { thumbnail: opts.thumbnail, images: [{ url: opts.thumbnail }] }
      : {}),
  }
  const res = await fetch(`${API}/vendor/products`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.memberToken}`,
      "x-seller-id": opts.sellerId,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json: any = null
  try {
    json = JSON.parse(text)
  } catch {
    /* */
  }
  return {
    status: res.status,
    product: json?.product ?? json?.products?.[0],
    text,
  }
}

export { getJson, postJson }
