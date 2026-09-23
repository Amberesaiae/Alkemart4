import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import {
  CollectionConflictError,
  CollectionValidationError,
} from "../../collections"
import type { AppEnv } from "../../context"
import { readJsonBody } from "../../lib/session"
import { requireSeller } from "../../middleware/auth"

const Visibility = z.enum(["draft", "published"])
const Text = (max: number) => z.string().trim().min(1).max(max)

const CreateBody = z.object({
  name: Text(80),
  slug: z.string().trim().min(1).max(80).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  imageUrl: z.string().trim().url().max(2048).optional().nullable(),
  visibility: Visibility.optional(),
})

const PatchBody = z
  .object({
    name: Text(80).optional(),
    slug: z.string().trim().min(1).max(80).optional().nullable(),
    description: z.string().trim().max(2000).optional().nullable(),
    imageUrl: z.string().trim().url().max(2048).optional().nullable(),
    visibility: Visibility.optional(),
    position: z.number().int().min(0).optional(),
    startsAt: z.string().trim().min(1).max(64).optional().nullable(),
    endsAt: z.string().trim().min(1).max(64).optional().nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty patch" })

const MembersBody = z.object({
  productIds: z.array(z.string().min(1)).max(30),
})

function sellerIdOrThrow(c: { get(k: "auth"): AppEnv["Variables"]["auth"] }): string {
  const sellerId = c.get("auth").sellerId
  if (!sellerId) throw new HTTPException(403, { message: "forbidden" })
  return sellerId
}

function mapCollectionError(err: unknown): never {
  if (err instanceof CollectionValidationError) {
    throw new HTTPException(400, { message: err.message })
  }
  if (err instanceof CollectionConflictError) {
    throw new HTTPException(409, { message: err.message })
  }
  throw err
}

/**
 * Phase 4A — vendor collection shelves (ADR-003). Seller-owned ordering
 * over the catalog; classification is never touched here.
 */
export const vendorCollections = new Hono<AppEnv>()
  .use("*", requireSeller)
  .get("/", async (c) => {
    const items = await c.get("collections").listVendorCollections(sellerIdOrThrow(c))
    return c.json({ items })
  })
  .post("/", async (c) => {
    const parsed = CreateBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    try {
      const item = await c.get("collections").createCollection(sellerIdOrThrow(c), parsed.data)
      return c.json({ item }, 201)
    } catch (err) {
      mapCollectionError(err)
    }
  })
  .get("/:id", async (c) => {
    const items = await c.get("collections").listVendorCollections(sellerIdOrThrow(c))
    const item = items.find((i) => i.id === c.req.param("id"))
    if (!item) throw new HTTPException(404, { message: "collection not found" })
    return c.json({ item })
  })
  .patch("/:id", async (c) => {
    const parsed = PatchBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    try {
      const item = await c
        .get("collections")
        .updateCollection(sellerIdOrThrow(c), c.req.param("id"), parsed.data)
      if (!item) throw new HTTPException(404, { message: "collection not found" })
      return c.json({ item })
    } catch (err) {
      if (err instanceof HTTPException) throw err
      mapCollectionError(err)
    }
  })
  .delete("/:id", async (c) => {
    const deleted = await c.get("collections").deleteCollection(sellerIdOrThrow(c), c.req.param("id"))
    if (!deleted) throw new HTTPException(404, { message: "collection not found" })
    return c.json({ deleted: true })
  })
  .put("/:id/products", async (c) => {
    const parsed = MembersBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    try {
      const item = await c
        .get("collections")
        .setCollectionProducts(sellerIdOrThrow(c), c.req.param("id"), parsed.data.productIds)
      if (!item) throw new HTTPException(404, { message: "collection not found" })
      return c.json({ item })
    } catch (err) {
      if (err instanceof HTTPException) throw err
      mapCollectionError(err)
    }
  })
