/**
 * Seller products — Workers only. Shapes mirror apps/api catalog DTOs.
 * Creation is draft-first: create draft → photos/specs/terms → send for
 * review (the API checks required specs at that step).
 */
import { getApiUrl } from "./env"
import { api } from "./http"
import { readSession } from "./session"

export type ProductStatus = "draft" | "proposed" | "published" | "rejected"

export type Offer = {
  id: string
  pricePesewas: string
  onHand: number
  reserved: number
  currency: string
  active: boolean
  condition: string | null
}

export type ProductOption = { id: string; name: string; values: { id: string; value: string; imageUrl: string | null }[] }
export type Combo = { variant: { id: string; sku: string | null; title: string | null }; offer: Offer; options: Record<string, string> }

export type VendorProduct = {
  product: {
    id: string
    title: string
    description: string | null
    status: ProductStatus
    primaryCategoryId: string
    imageUrl: string | null
    createdAt: string | null
  }
  variant: { id: string; sku: string | null; title: string | null }
  offer: Offer
  images: { url: string; alt: string | null }[]
  options: ProductOption[]
  variants: Combo[]
  /** Latest review: decision + reasons in the seller's words. */
  review?: SellerReview | null
}

export type SellerReview = {
  decision: "submitted" | "approve" | "reject" | "request_changes" | "escalate"
  by: "team" | "you" | "automatic check"
  reasons: { code: string; message: string; field?: string }[]
  note: string | null
  at: string
}

/**
 * GET /vendor/products returns one row PER VARIANT (offer); each row already
 * carries the product's full `variants`, `options` and `images`. Collapse to
 * one entry per product so a 3-colour shirt is one product, not three.
 */
export const listProducts = () =>
  api<{ items: VendorProduct[] }>("/vendor/products").then((r) => {
    const byId = new Map<string, VendorProduct>()
    for (const row of r.items) if (!byId.has(row.product.id)) byId.set(row.product.id, row)
    return [...byId.values()]
  })

export const getProduct = async (id: string) => {
  const all = await listProducts()
  const hit = all.find((p) => p.product.id === id)
  if (!hit) throw Object.assign(new Error("Product not found"), { status: 404 })
  return hit
}

export type CreateProductInput = {
  title: string
  description?: string | null
  primaryCategoryId: string
  pricePesewas: string
  onHand: number
  imageUrl?: string | null
  variant_options?: { name: string; values: string[] }[]
  variant_entries?: { options: Record<string, string>; pricePesewas?: string; quantity?: number }[]
  draft?: boolean
}

export const createProduct = (input: CreateProductInput) =>
  api<VendorProduct>("/vendor/products", { method: "POST", json: input })

export const updateProduct = (id: string, patch: Partial<Pick<CreateProductInput, "title" | "description" | "primaryCategoryId">> & { active?: boolean }) =>
  api<VendorProduct>(`/vendor/products/${encodeURIComponent(id)}`, { method: "PATCH", json: patch })

export const setImages = (id: string, images: { url: string; alt?: string | null }[]) =>
  api<VendorProduct>(`/vendor/products/${encodeURIComponent(id)}/images`, { method: "PUT", json: { images } })

export const updateVariant = (
  id: string,
  variantId: string,
  patch: { pricePesewas?: string; onHand?: number; active?: boolean; condition?: string | null },
) => api<VendorProduct>(`/vendor/products/${encodeURIComponent(id)}/variants/${encodeURIComponent(variantId)}`, { method: "PATCH", json: patch })

export const sendForReview = (id: string) => api<VendorProduct>(`/vendor/products/${encodeURIComponent(id)}/propose`, { method: "POST" })

/** Ask for a second look at a rejected listing. */
export const appealProduct = (id: string, message: string) =>
  api<{ appeal: { id: string } }>(`/vendor/products/${encodeURIComponent(id)}/appeal`, { method: "POST", json: { message } })

export const deleteProduct = (id: string) => api<{ ok: true }>(`/vendor/products/${encodeURIComponent(id)}`, { method: "DELETE" })

// ─── Categories & category fields ───────────────────────────────────────

export type CategoryNode = { id: string; handle: string; name: string; children?: CategoryNode[] }

export const listCategories = () => api<{ categories: CategoryNode[] }>("/store/categories").then((r) => r.categories)

/** Leaves with their breadcrumb, for a searchable picker. */
export function flattenCategories(nodes: CategoryNode[], trail: string[] = []): { id: string; name: string; path: string }[] {
  return nodes.flatMap((n) => {
    const here = [...trail, n.name]
    const kids = n.children ?? []
    return kids.length ? flattenCategories(kids, here) : [{ id: n.id, name: n.name, path: here.join(" › ") }]
  })
}

export type AttributeField = {
  id: string
  code: string
  label: string
  type: "text" | "number" | "boolean" | "option" | "multi_option"
  unitFamily: string | null
  allowedValues: string[] | null
  required: boolean
}

export const formFields = (categoryId: string) =>
  api<{ profileId: string | null; fields: AttributeField[] }>(`/vendor/products/form-fields?categoryId=${encodeURIComponent(categoryId)}`)

export type AttributeValue = {
  definitionId: string
  textValue?: string | null
  numberValue?: number | null
  booleanValue?: boolean | null
  optionValues?: string[] | null
}

export const setAttributes = (id: string, values: AttributeValue[]) =>
  api<{ values: AttributeValue[] }>(`/vendor/products/${encodeURIComponent(id)}/attributes`, { method: "PUT", json: values })

export const getAttributes = (id: string) =>
  api<{ values: (AttributeValue & { definitionId: string })[] }>(`/vendor/products/${encodeURIComponent(id)}/attributes`)

/** Draft spec values from the title/description (Workers AI); the seller confirms. */
export const suggestAttributes = (id: string) =>
  api<{ suggestions: (AttributeValue & { code: string; label: string })[] }>(
    `/vendor/products/${encodeURIComponent(id)}/attributes/suggest`,
    { method: "POST" },
  )

// ─── Photos ─────────────────────────────────────────────────────────────

/**
 * Shrink a phone photo before upload: longest side ≤ 1600px, JPEG ~82%.
 * A 5 MB camera shot becomes ~250 KB — the difference between an upload
 * that finishes on mobile data and one that doesn't.
 */
export async function compressImage(file: File, max = 1600, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality))
  return blob && blob.size < file.size ? blob : file
}

/** POST /vendor/uploads (multipart). Returns the served URL. */
export async function uploadImage(
  file: File,
  onProgress?: (pct: number) => void,
  kind: "products" | "logos" | "banners" = "products",
): Promise<string> {
  const blob = await compressImage(file)
  const form = new FormData()
  const name = file.name.replace(/\.[^.]+$/, "") + (blob.type === "image/jpeg" ? ".jpg" : "")
  form.append("file", new File([blob], name, { type: blob.type || file.type }))
  form.append("kind", kind)
  const token = readSession()?.token
  // XHR (not fetch) so a slow connection shows real progress.
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", `${getApiUrl()}/vendor/uploads`)
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`)
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100))
    xhr.onerror = () => reject(Object.assign(new Error("Upload failed — check your connection"), { status: undefined }))
    xhr.onload = () => {
      const body = (() => {
        try {
          return JSON.parse(xhr.responseText) as { files?: { url: string }[]; error?: string }
        } catch {
          return {} as { files?: { url: string }[]; error?: string }
        }
      })()
      if (xhr.status >= 200 && xhr.status < 300 && body.files?.[0]?.url) resolve(body.files[0].url)
      else reject(Object.assign(new Error(body.error || `Upload failed (${xhr.status})`), { status: xhr.status }))
    }
    xhr.send(form)
  })
}

// ─── Derived views ──────────────────────────────────────────────────────

export type Shelf = "live" | "in-review" | "needs-changes" | "draft" | "out-of-stock" | "low-stock"

export const LOW_STOCK_AT = 5

export function stockOf(p: VendorProduct) {
  const combos = p.variants.length ? p.variants : [{ offer: p.offer } as Combo]
  return combos.filter((c) => c.offer.active).reduce((n, c) => n + Math.max(0, c.offer.onHand - c.offer.reserved), 0)
}

export function priceRange(p: VendorProduct): [number, number] {
  const combos = p.variants.length ? p.variants : [{ offer: p.offer } as Combo]
  const prices = combos.filter((c) => c.offer.active).map((c) => Number(c.offer.pricePesewas))
  if (!prices.length) return [Number(p.offer.pricePesewas), Number(p.offer.pricePesewas)]
  return [Math.min(...prices), Math.max(...prices)]
}

/** Which shelf a product sits on for the seller (one each, most urgent first). */
export function shelfOf(p: VendorProduct): Shelf {
  const sentBack = p.review?.decision === "request_changes" || p.review?.decision === "reject"
  if (p.product.status === "rejected" || (sentBack && p.product.status !== "published")) return "needs-changes"
  if (p.product.status === "draft") return "draft"
  if (p.product.status === "proposed") return "in-review"
  const s = stockOf(p)
  if (s === 0) return "out-of-stock"
  if (s <= LOW_STOCK_AT) return "low-stock"
  return "live"
}
