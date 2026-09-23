import { hashPassword } from "@alkemart/domain"
import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import type { ApiEnv, ImagesBindingLike } from "../../env"
import { createApp } from "../../index"
import { resetRateLimits } from "../../middleware/security"
import { sniffImageType } from "./uploads"
// Rate-limit counters are per-process: reset so files stay isolated.
resetRateLimits()

const JWT_SECRET = "test-jwt-secret-that-is-at-least-32-chars-long"

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0])

type Stored = { body: Uint8Array; contentType: string }

function fakeBucket() {
  const store = new Map<string, Stored>()
  return {
    store,
    bucket: {
      put: async (key: string, body: ArrayBuffer | Uint8Array, opts?: { httpMetadata?: { contentType?: string } }) => {
        const bytes = body instanceof Uint8Array ? body : new Uint8Array(body)
        store.set(key, { body: bytes, contentType: opts?.httpMetadata?.contentType ?? "application/octet-stream" })
      },
      get: async (key: string) => {
        const entry = store.get(key)
        if (!entry) return null
        return {
          body: entry.body,
          etag: `"test-${entry.body.length}"`,
          httpMetadata: { contentType: entry.contentType },
        }
      },
    } as unknown as R2Bucket,
  }
}

function testEnv(bucket?: R2Bucket, images?: ImagesBindingLike): ApiEnv {
  return {
    ENVIRONMENT: "development",
    JWT_SECRET,
    HYPERDRIVE: { connectionString: "postgres://x" },
    HYPERDRIVE_PRIMARY: { connectionString: "postgres://x" },
    CATALOG_KV: {} as KVNamespace,
    ...(bucket ? { MEDIA_BUCKET: bucket } : {}),
    ...(images ? { IMAGES: images } : {}),
  }
}

function fakeImages(): ImagesBindingLike {
  return {
    input: () => ({
      transform: () => ({
        output: () => ({
          response: async () => new Response(new Uint8Array([9, 9, 9])),
        }),
      }),
    }),
  }
}

async function sellerToken(app: ReturnType<typeof createApp>, email = "vendor@alkemart.test") {
  const res = await app.request(
    "/vendor/auth/register",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password: "VendorPass1",
        sellerName: "Accra Mart",
        sellerHandle: "accra-mart",
      }),
    },
    testEnv(),
  )
  expect(res.status).toBe(201)
  const body = (await res.json()) as { token: string }
  return body.token
}

function uploadInit(token: string | null, file: File | null) {
  const form = new FormData()
  if (file) form.append("files", file)
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  return { method: "POST" as const, headers, body: form }
}

describe("POST /vendor/uploads", () => {
  it("stores a valid image in R2 and returns a same-origin /media URL", async () => {
    const { bucket, store } = fakeBucket()
    const app = createApp({ authRepo: new InMemoryAuthRepository(), jwtSecret: JWT_SECRET })
    const token = await sellerToken(app)

    const res = await app.request(
      "/vendor/uploads",
      uploadInit(token, new File([PNG], "photo.png", { type: "image/png" })),
      testEnv(bucket),
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as { files: { url: string; key: string; contentType: string; size: number }[] }
    expect(body.files).toHaveLength(1)
    const [{ url, key }] = body.files
    expect(key).toMatch(/^products\/[A-Za-z0-9_-]+\/[A-Za-z0-9-]+\.png$/)
    expect(url).toMatch(new RegExp(`/media/${key}$`))
    expect(url.startsWith("http")).toBe(true)
    expect(store.has(key)).toBe(true)

    // Round-trip through the public media route.
    const served = await app.request(new URL(url).pathname, {}, testEnv(bucket))
    expect(served.status).toBe(200)
    expect(served.headers.get("Content-Type")).toBe("image/png")
    expect(served.headers.get("Cache-Control")).toContain("immutable")
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(PNG)
  })

  it("accepts WebP and GIF bytes and serves every stored variant", async () => {
    const { bucket } = fakeBucket()
    const app = createApp({ authRepo: new InMemoryAuthRepository(), jwtSecret: JWT_SECRET })
    const token = await sellerToken(app)

    for (const [bytes, name, type, ext] of [
      [WEBP, "a.webp", "image/webp", "webp"],
      [GIF, "a.gif", "image/gif", "gif"],
    ] as const) {
      const form = new FormData()
      form.append("files", new File([bytes], name, { type }))
      const res = await app.request(
        "/vendor/uploads",
        { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form },
        testEnv(bucket, fakeImages()),
      )
      expect(res.status).toBe(201)
      const body = (await res.json()) as {
        files: {
          key: string
          variants: { original: { key: string }; web: { key: string } | null; thumb: { key: string } | null }
        }[]
      }
      const [file] = body.files
      expect(file.key.endsWith(".webp")).toBe(true)
      expect(file.variants.original.key.endsWith(`.${ext}`)).toBe(true)
      expect(file.variants.thumb?.key.endsWith(".thumb.webp")).toBe(true)
      // Every stored variant serves with an image content type.
      for (const v of [file.variants.original, file.variants.web!, file.variants.thumb!]) {
        const served = await app.request(`/media/${v.key}`, {}, testEnv(bucket))
        expect(served.status).toBe(200)
        expect(served.headers.get("Content-Type") ?? "").toMatch(/^image\//)
      }
    }
  })

  it("accepts field name `file` and JPEG bytes", async () => {
    const { bucket } = fakeBucket()
    const app = createApp({ authRepo: new InMemoryAuthRepository(), jwtSecret: JWT_SECRET })
    const token = await sellerToken(app)
    const form = new FormData()
    form.append("file", new File([JPG], "photo.jpg", { type: "image/jpeg" }))
    const res = await app.request(
      "/vendor/uploads",
      { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form },
      testEnv(bucket),
    )
    expect(res.status).toBe(201)
  })

  it("scopes keys by kind and derives WebP variants through the Images pipeline", async () => {
    const { bucket, store } = fakeBucket()
    const app = createApp({ authRepo: new InMemoryAuthRepository(), jwtSecret: JWT_SECRET })
    const token = await sellerToken(app)

    const form = new FormData()
    form.append("files", new File([PNG], "logo.png", { type: "image/png" }))
    form.append("kind", "logos")
    const res = await app.request(
      "/vendor/uploads",
      { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form },
      testEnv(bucket, fakeImages()),
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as {
      files: {
        url: string
        key: string
        variants: { original: { url: string; key: string }; web: { url: string; key: string } | null; thumb: { url: string; key: string } | null }
      }[]
    }
    const [file] = body.files
    expect(file.key).toMatch(/^logos\/[A-Za-z0-9_-]+\/[A-Za-z0-9-]+\.webp$/)
    expect(file.url).toMatch(/\.webp$/)
    expect(file.variants.original.key).toMatch(/\.png$/)
    expect(file.variants.thumb?.key).toMatch(/\.thumb\.webp$/)
    expect(store.has(file.key)).toBe(true)
    expect(store.has(file.variants.original.key)).toBe(true)
    expect(store.has(file.variants.thumb!.key)).toBe(true)

    // Unknown kinds fall back to products.
    const fallback = new FormData()
    fallback.append("files", new File([PNG], "x.png", { type: "image/png" }))
    fallback.append("kind", "../../etc")
    const res2 = await app.request(
      "/vendor/uploads",
      { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fallback },
      testEnv(bucket),
    )
    expect(res2.status).toBe(201)
    const body2 = (await res2.json()) as { files: { key: string }[] }
    expect(body2.files[0].key.startsWith("products/")).toBe(true)
  })

  it("sniffs true content types so spoofs cannot pass as another type", async () => {
    expect(sniffImageType(PNG)).toBe("image/png")
    expect(sniffImageType(JPG)).toBe("image/jpeg")
    expect(sniffImageType(WEBP)).toBe("image/webp")
    expect(sniffImageType(GIF)).toBe("image/gif")
    expect(sniffImageType(new Uint8Array([1, 2, 3]))).toBeNull()
    expect(sniffImageType(new Uint8Array([]))).toBeNull()
    // PNG bytes never sniff as JPEG: the route binds sniffed-vs-declared.
    expect(sniffImageType(PNG)).not.toBe("image/jpeg")
  })

  it("rejects wrong types and missing files", async () => {
    const { bucket } = fakeBucket()
    const app = createApp({ authRepo: new InMemoryAuthRepository(), jwtSecret: JWT_SECRET })
    const token = await sellerToken(app)

    // Plain text.
    const text = await app.request(
      "/vendor/uploads",
      uploadInit(token, new File(["hello"], "note.txt", { type: "text/plain" })),
      testEnv(bucket),
    )
    expect(text.status).toBe(415)

    // No file field at all.
    const empty = await app.request("/vendor/uploads", uploadInit(token, null), testEnv(bucket))
    expect(empty.status).toBe(400)
  })

  it("rejects oversized images", async () => {
    const { bucket } = fakeBucket()
    const app = createApp({ authRepo: new InMemoryAuthRepository(), jwtSecret: JWT_SECRET })
    const token = await sellerToken(app)
    const big = new Uint8Array(5 * 1024 * 1024 + 1)
    big.set(PNG.subarray(0, 8))
    const res = await app.request(
      "/vendor/uploads",
      uploadInit(token, new File([big], "big.png", { type: "image/png" })),
      testEnv(bucket),
    )
    expect(res.status).toBe(413)
  })

  it("requires a seller session and a media bucket", async () => {
    const { bucket } = fakeBucket()
    const app = createApp({ authRepo: new InMemoryAuthRepository(), jwtSecret: JWT_SECRET })

    const anon = await app.request(
      "/vendor/uploads",
      uploadInit(null, new File([PNG], "photo.png", { type: "image/png" })),
      testEnv(bucket),
    )
    expect(anon.status).toBe(401)

    const token = await sellerToken(app)
    const noBucket = await app.request(
      "/vendor/uploads",
      uploadInit(token, new File([PNG], "photo.png", { type: "image/png" })),
      testEnv(),
    )
    expect(noBucket.status).toBe(501)
  })
})

describe("POST /admin/uploads", () => {
  it("stores merch art under merch/ and serves it from /media", async () => {
    const { bucket, store } = fakeBucket()
    const authRepo = new InMemoryAuthRepository()
    await authRepo.createUser({
      id: "admin-1",
      email: "admin@alkemart.test",
      passwordHash: await hashPassword("AdminPass1"),
      role: "admin",
    })
    const app = createApp({ authRepo, jwtSecret: JWT_SECRET })
    const login = await app.request("/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@alkemart.test", password: "AdminPass1" }),
    }, testEnv(bucket))
    expect(login.status).toBe(200)
    const token = ((await login.json()) as { token: string }).token

    const res = await app.request(
      "/admin/uploads",
      uploadInit(token, new File([PNG], "hero.png", { type: "image/png" })),
      testEnv(bucket),
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as { files: { url: string; key: string }[] }
    expect(body.files[0]?.key).toMatch(/^merch\/admin-1\/.+\.png$/)
    expect(body.files[0]?.url).toMatch(/^https?:\/\/.+\/media\/merch\//)
    expect(store.has(body.files[0]!.key)).toBe(true)

    const served = await app.request(new URL(body.files[0]!.url).pathname, {}, testEnv(bucket))
    expect(served.status).toBe(200)
  })

  it("rejects a seller token", async () => {
    const { bucket } = fakeBucket()
    const app = createApp({ authRepo: new InMemoryAuthRepository(), jwtSecret: JWT_SECRET })
    const token = await sellerToken(app)
    const res = await app.request(
      "/admin/uploads",
      uploadInit(token, new File([PNG], "hero.png", { type: "image/png" })),
      testEnv(bucket),
    )
    expect(res.status).toBe(403)
  })
})

describe("GET /media/*", () => {
  it("404s on unknown keys and unsafe paths", async () => {
    const { bucket } = fakeBucket()
    const app = createApp({ authRepo: new InMemoryAuthRepository(), jwtSecret: JWT_SECRET })
    const env = testEnv(bucket)

    expect((await app.request("/media/products/nope/missing.png", {}, env)).status).toBe(404)
    expect((await app.request("/media/../../etc/passwd", {}, env)).status).toBe(404)
    expect((await app.request("/media/products/x/evil.exe", {}, env)).status).toBe(404)
  })
})
