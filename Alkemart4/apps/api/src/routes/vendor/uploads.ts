import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import type { AppEnv } from "../../context"
import { requireSeller } from "../../middleware/auth"

/** Vendor product/seller images. 5 MB cap matches the vendor UI validator. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

/** Upload namespaces. Keys are always `{kind}/{sellerId}/{uuid}[.thumb].{ext}`. */
const KINDS = ["products", "logos", "banners"] as const
type MediaKind = (typeof KINDS)[number]

const ALLOWED: Record<string, { ext: string; magic: (b: Uint8Array) => boolean }> = {
  "image/jpeg": {
    ext: "jpg",
    magic: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  "image/png": {
    ext: "png",
    magic: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  "image/webp": {
    ext: "webp",
    magic: (b) =>
      b.length >= 12 &&
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // RIFF
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50, // WEBP
  },
  "image/gif": {
    ext: "gif",
    magic: (b) =>
      b.length >= 6 &&
      b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 && // GIF8
      (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61, // 7a | 9a
  },
}

function bucketOrThrow(c: { env: AppEnv["Bindings"] }): R2Bucket {
  const bucket = c.env.MEDIA_BUCKET
  if (!bucket) throw new HTTPException(501, { message: "media storage unavailable" })
  return bucket
}

type Variant = { url: string; key: string }

async function convert(
  images: AppEnv["Bindings"]["IMAGES"],
  bytes: Uint8Array,
  width: number,
  quality: number,
): Promise<Uint8Array | null> {
  if (!images) return null
  try {
    // Shape differs by runtime: production exposes .response() as a method;
    // wrangler dev currently stubs .output() with an empty object.
    const chained = images.input(bytes).transform({ width, fit: "scale-down" })
    const out = chained.output({ format: "image/webp", quality }) as unknown as {
      response?: unknown
    }
    const res =
      typeof out?.response === "function"
        ? await (out.response as () => Promise<Response>)()
        : (out as unknown as Response)
    if (!res || typeof res.ok !== "boolean" || !res.ok) {
      console.warn(`[media] images transform !ok (width=${width})`)
      return null
    }
    return new Uint8Array(await res.arrayBuffer())
  } catch (err) {
    console.warn(`[media] images transform failed (width=${width}): ${err instanceof Error ? err.message : err}`)
    return null
  }
}

/**
 * POST /vendor/uploads — store one product/seller image in R2.
 * Medusa-compatible shape: multipart field `files` (+ optional `kind`
 * in {products,logos,banners}, default products), responds `{ files: [{ url }] }`.
 * Conversion pipeline: the original is always kept; when the Images binding
 * is present the upload also derives a ≤1600px WebP (`url`) and a 400px
 * WebP thumb. `wrangler dev` stubs Images, so local uploads store the
 * original only — variants appear once deployed with Images enabled.
 * URLs are same-origin (`/media/<key>`) so they pass the product imageUrl
 * validator and need no extra public-bucket wiring.
 */
export const vendorUploads = new Hono<AppEnv>().use("*", requireSeller).post("/", async (c) => {
  const bucket = bucketOrThrow(c)
  const auth = c.get("auth")
  const sellerId = auth.sellerId ?? ""
  if (!/^[A-Za-z0-9_-]+$/.test(sellerId)) throw new HTTPException(403, { message: "forbidden" })

  let form: FormData
  try {
    form = await c.req.formData()
  } catch {
    throw new HTTPException(400, { message: "expected multipart form with a file" })
  }
  const entry = form.get("files") ?? form.get("file")
  // NB: `typeof` guard, not `instanceof File` — the Workers lib File
  // declaration makes instanceof narrow the union to never.
  if (typeof entry !== "object" || entry === null) {
    throw new HTTPException(400, { message: "missing file field" })
  }
  const file = entry as File
  const kindRaw = form.get("kind")
  const kind: MediaKind =
    typeof kindRaw === "string" && (KINDS as readonly string[]).includes(kindRaw)
      ? (kindRaw as MediaKind)
      : "products"

  const spec = ALLOWED[file.type]
  if (!spec) throw new HTTPException(415, { message: "only PNG, JPG, WebP, or GIF images are accepted" })
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    throw new HTTPException(413, { message: "image must be smaller than 5 MB" })
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!spec.magic(bytes)) throw new HTTPException(415, { message: "file content does not match its type" })

  const origin = new URL(c.req.url).origin
  const base = `${kind}/${sellerId}/${crypto.randomUUID()}`
  const originalKey = `${base}.${spec.ext}`
  await bucket.put(originalKey, bytes, { httpMetadata: { contentType: file.type } })
  const original: Variant = { url: `${origin}/media/${originalKey}`, key: originalKey }

  // Conversion pipeline: WebP full + thumb. Falls back to original-only.
  const [webBytes, thumbBytes] = await Promise.all([
    convert(c.env.IMAGES, bytes, 1600, 82),
    convert(c.env.IMAGES, bytes, 400, 78),
  ])
  let web: Variant | null = null
  let thumb: Variant | null = null
  if (webBytes) {
    const key = `${base}.webp`
    await bucket.put(key, webBytes, { httpMetadata: { contentType: "image/webp" } })
    web = { url: `${origin}/media/${key}`, key }
  }
  if (thumbBytes) {
    const key = `${base}.thumb.webp`
    await bucket.put(key, thumbBytes, { httpMetadata: { contentType: "image/webp" } })
    thumb = { url: `${origin}/media/${key}`, key }
  }

  const primary = web ?? original
  return c.json(
    {
      files: [
        {
          url: primary.url,
          key: primary.key,
          contentType: web ? "image/webp" : file.type,
          size: file.size,
          variants: {
            original,
            web,
            thumb,
          },
        },
      ],
    },
    201,
  )
})

const KEY_PATTERN =
  /^(products|logos|banners)\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+(?:\.thumb)?\.(jpg|png|webp|gif)$/

/** GET /media/* — serve R2 images with immutable caching. Public, no auth. */
export async function serveMedia(c: {
  req: { path: string }
  env: AppEnv["Bindings"]
  notFound: () => Response | Promise<Response>
}): Promise<Response> {
  const bucket = c.env.MEDIA_BUCKET
  const key = c.req.path.replace(/^\/media\//, "")
  if (!bucket || !KEY_PATTERN.test(key)) return c.notFound()
  const object = await bucket.get(key)
  if (!object) return c.notFound()
  const headers = new Headers()
  headers.set("Content-Type", object.httpMetadata?.contentType ?? "application/octet-stream")
  headers.set("Cache-Control", "public, max-age=31536000, immutable")
  if (object.etag) headers.set("ETag", object.etag)
  return new Response(object.body, { status: 200, headers })
}
