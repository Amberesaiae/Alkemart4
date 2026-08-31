import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import {
  CatalogConflictError,
  CatalogValidationError,
} from "../../catalog-repository"
import type { AppEnv } from "../../context"
import { readJsonBody } from "../../lib/session"
import { requireSeller } from "../../middleware/auth"

const PesewasString = z.string().regex(/^\d+$/)

const CreateBody = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  primaryCategoryId: z.string().trim().min(1),
  pricePesewas: PesewasString,
  onHand: z.number().int().min(0),
  sku: z.string().trim().min(1).max(64).optional().nullable(),
  variantTitle: z.string().trim().min(1).max(120).optional().nullable(),
})

const PatchBody = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(5000).optional().nullable(),
    primaryCategoryId: z.string().trim().min(1).optional(),
    pricePesewas: PesewasString.optional(),
    onHand: z.number().int().min(0).optional(),
    active: z.boolean().optional(),
    sku: z.string().trim().min(1).max(64).optional().nullable(),
    variantTitle: z.string().trim().min(1).max(120).optional().nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty patch" })

function sellerIdOrThrow(c: { get: (k: "auth") => { sellerId?: string } }) {
  const sellerId = c.get("auth").sellerId
  if (!sellerId) throw new HTTPException(403, { message: "forbidden" })
  return sellerId
}

function mapCatalogWriteError(err: unknown): never {
  if (err instanceof CatalogValidationError) {
    throw new HTTPException(400, { message: err.message })
  }
  if (err instanceof CatalogConflictError) {
    throw new HTTPException(409, { message: err.message })
  }
  throw err
}

export const vendorProducts = new Hono<AppEnv>()
  .use("*", requireSeller)
  .get("/", async (c) => {
    const sellerId = sellerIdOrThrow(c)
    const items = await c.get("repo").listVendorProducts(sellerId)
    return c.json({ items })
  })
  .post("/", async (c) => {
    const parsed = CreateBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const sellerId = sellerIdOrThrow(c)
    try {
      const created = await c.get("repo").createVendorProduct({
        sellerId,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        primaryCategoryId: parsed.data.primaryCategoryId,
        pricePesewas: BigInt(parsed.data.pricePesewas),
        onHand: parsed.data.onHand,
        sku: parsed.data.sku ?? null,
        variantTitle: parsed.data.variantTitle ?? null,
      })
      return c.json(created, 201)
    } catch (err) {
      mapCatalogWriteError(err)
    }
  })
  .patch("/:id", async (c) => {
    const parsed = PatchBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const sellerId = sellerIdOrThrow(c)
    try {
      const updated = await c.get("repo").updateVendorProduct(sellerId, c.req.param("id"), {
        ...parsed.data,
        pricePesewas:
          parsed.data.pricePesewas !== undefined
            ? BigInt(parsed.data.pricePesewas)
            : undefined,
      })
      if (!updated) throw new HTTPException(404, { message: "product not found" })
      return c.json(updated)
    } catch (err) {
      if (err instanceof HTTPException) throw err
      mapCatalogWriteError(err)
    }
  })
  .post("/:id/propose", async (c) => {
    const sellerId = sellerIdOrThrow(c)
    const updated = await c.get("repo").proposeVendorProduct(sellerId, c.req.param("id"))
    if (!updated) throw new HTTPException(404, { message: "product not found" })
    return c.json(updated)
  })
