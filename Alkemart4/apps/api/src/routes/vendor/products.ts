import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import {
  CatalogConflictError,
  CatalogValidationError,
} from "../../catalog-repository"
import { checkSendPermission } from "@alkemart/domain"
import { toE164Ghana } from "../../sms"
import type { AppEnv } from "../../context"
import { readJsonBody } from "../../lib/session"
import { requireSeller } from "../../middleware/auth"
import { MAX_ATTRIBUTES, parseProductAttributes } from "@alkemart/shared/product-attributes"

const AttributeBody = z.array(
  z.object({ label: z.string(), value: z.string() }),
).max(MAX_ATTRIBUTES)

const PesewasString = z.string().regex(/^\d+$/)

/** Product images: vendor uploads via POST /vendor/uploads (R2), served from /media/*. */
const ImageUrl = z
  .string()
  .trim()
  .url()
  .max(2048)
  .refine((v) => v.startsWith("https://") || v.startsWith("http://"), {
    message: "image URL must be http(s)",
  })

const VariantOptionBody = z.object({
  name: z.string().trim().min(1).max(40),
  values: z.array(z.string().trim().min(1).max(40)).min(1).max(20),
})

const VariantEntryBody = z.object({
  options: z.record(z.string().trim().min(1), z.string().trim().min(1)),
  pricePesewas: PesewasString.optional(),
  quantity: z.number().int().min(0).optional(),
  sku: z.string().trim().min(1).max(64).optional().nullable(),
})

const IdentityBody = z.object({
  brand: z.string().trim().max(120).optional().nullable(),
  model: z.string().trim().max(120).optional().nullable(),
  gtin: z.string().trim().max(32).optional().nullable(),
  mpn: z.string().trim().max(64).optional().nullable(),
  manufacturer: z.string().trim().max(120).optional().nullable(),
  productType: z.string().trim().max(80).optional().nullable(),
})

const AttributeValueBody = z.object({
  definitionId: z.string().min(1),
  textValue: z.string().max(2000).optional().nullable(),
  numberValue: z.number().finite().optional().nullable(),
  booleanValue: z.boolean().optional().nullable(),
  optionValues: z.array(z.string().trim().min(1).max(80)).max(50).optional().nullable(),
  unit: z.string().trim().max(20).optional().nullable(),
})

const CreateBody = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  primaryCategoryId: z.string().trim().min(1),
  pricePesewas: PesewasString,
  onHand: z.number().int().min(0),
  sku: z.string().trim().min(1).max(64).optional().nullable(),
  variantTitle: z.string().trim().min(1).max(120).optional().nullable(),
  imageUrl: ImageUrl.optional().nullable(),
  attributes: AttributeBody.optional(),
  identity: IdentityBody.optional(),
  variant_options: z.array(VariantOptionBody).max(2).optional(),
  variant_entries: z.array(VariantEntryBody).max(30).optional(),
})

const VariantPatchBody = z
  .object({
    pricePesewas: PesewasString.optional(),
    onHand: z.number().int().min(0).optional(),
    active: z.boolean().optional(),
    /** Phase 3A offer terms; compare-at requires provenance (400 otherwise). */
    condition: z.string().trim().min(1).max(40).optional().nullable(),
    compareAtPesewas: PesewasString.optional().nullable(),
    compareAtProvenance: z.string().trim().min(1).max(500).optional().nullable(),
    fulfillmentOrigin: z.string().trim().min(1).max(200).optional().nullable(),
    warrantyRef: z.string().trim().min(1).max(500).optional().nullable(),
    returnsRef: z.string().trim().min(1).max(500).optional().nullable(),
    deliveryPromise: z.string().trim().min(1).max(200).optional().nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty patch" })

const AddOptionBody = z.object({
  optionId: z.string().min(1).optional(),
  optionName: z.string().trim().min(1).max(40).optional(),
  value: z.string().trim().min(1).max(40),
  existingValue: z.string().trim().min(1).max(40).optional(),
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
    imageUrl: ImageUrl.optional().nullable(),
    attributes: AttributeBody.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty patch" })

/**
 * Normalise labels on write so the same fact keeps the same name across
 * shops. A validation failure is a 400 with the vendor-facing reason, not a
 * silently dropped field.
 */
function normalizeAttributes(
  raw: { label: string; value: string }[] | undefined,
): { label: string; value: string }[] | undefined {
  if (raw === undefined) return undefined
  const parsed = parseProductAttributes(raw)
  if (!parsed.ok) throw new HTTPException(400, { message: parsed.error })
  return parsed.attributes
}

function sellerIdOrThrow(c: { get: (k: "auth") => { sellerId?: string } }) {
  const sellerId = c.get("auth").sellerId
  if (!sellerId) throw new HTTPException(403, { message: "forbidden" })
  return sellerId
}

/**
 * Phase 7B — stock/price alert fan-out. Runs after a variant write, never
 * fails it. Subscription is consent (operational); opted-out rows are
 * consumed, contacts resolve from the buyer's own orders, sends cap at 3
 * per contact per day, and firing deletes the subscription (one-shot).
 */
async function fireStockPriceAlerts(
  c: { get(k: "checkoutRepo"): AppEnv["Variables"]["checkoutRepo"] },
  input: {
    offerId: string
    title: string
    before: { pricePesewas: bigint; onHand: number; active: boolean }
    after: { pricePesewas: bigint; onHand: number; active: boolean }
  },
): Promise<void> {
  try {
    const checkout = c.get("checkoutRepo")
    const priceDown = input.after.pricePesewas < input.before.pricePesewas
    const restocked = input.before.onHand <= 0 && input.after.onHand > 0 && input.after.active
    if (!priceDown && !restocked) return
    const subs = await checkout.listStockSubscriptions({ offerId: input.offerId }).catch(() => [])
    for (const sub of subs) {
      try {
        if (sub.kind === "back_in_stock" && !restocked) continue
        if (sub.kind === "price_drop") {
          if (!priceDown) continue
          if (sub.belowPesewas == null || input.after.pricePesewas > BigInt(sub.belowPesewas)) continue
        }
        const prefs = await checkout.listNotificationPreferences("buyer", sub.buyerEmail).catch(() => [])
        const decision = checkSendPermission(
          prefs.map((p) => ({
            channel: p.channel,
            category: p.category,
            topic: p.topic,
            optedIn: p.optedIn,
            frequencyCap: p.frequencyCap,
          })),
          { channel: sub.channel, category: "operational" },
        )
        // Refused consent consumes the subscription: keeping it would spam
        // someone who opted out on every future restock.
        if (!decision.allowed) {
          await checkout.deleteStockSubscription(sub.id, sub.buyerEmail).catch(() => {})
          continue
        }
        const phoneRaw = await checkout.latestBuyerPhone(sub.buyerEmail).catch(() => null)
        const to = phoneRaw ? toE164Ghana(phoneRaw) : null
        // No verified contact yet: keep the subscription for next time.
        if (!to) continue
        const sent = await checkout
          .countRecentSends(to, sub.channel, new Date(Date.now() - 24 * 3_600_000))
          .catch(() => 0)
        if (sent >= 3) continue
        const body =
          sub.kind === "back_in_stock"
            ? `Alkemart: "${input.title}" is back in stock — check it before it sells through.`
            : `Alkemart: "${input.title}" dropped to your target price — check it before it moves again.`
        const done = await checkout
          .enqueueNotification({
            key: `sub:${sub.id}`,
            recipient: to,
            body,
            channel: sub.channel,
            category: "operational",
          })
          .catch(() => ({ inserted: false }))
        if (done.inserted) {
          await checkout.deleteStockSubscription(sub.id, sub.buyerEmail).catch(() => {})
        }
      } catch {
        /* one bad subscription never blocks the rest */
      }
    }
  } catch {
    /* alerts never fail writes */
  }
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
    // Double-submit guard: an identical proposed product minted in the last
    // 10 minutes is a retry, not a second listing. Deliberate duplicates
    // (different title/category, or later) still create.
    const existing: Awaited<ReturnType<AppEnv["Variables"]["repo"]["listVendorProducts"]>> =
      await c.get("repo").listVendorProducts(sellerId).catch(() => [])
    const dupe = existing.find(
      (v) =>
        v.product.status === "proposed" &&
        v.product.title.trim().toLowerCase() === parsed.data.title.trim().toLowerCase() &&
        v.product.primaryCategoryId === parsed.data.primaryCategoryId &&
        v.product.createdAt &&
        Date.now() - new Date(v.product.createdAt).getTime() < 10 * 60 * 1000,
    )
    if (dupe) return c.json({ ...dupe, replayed: true }, 200)
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
        imageUrl: parsed.data.imageUrl ?? null,
        attributes: normalizeAttributes(parsed.data.attributes),
        identity: parsed.data.identity ?? undefined,
        variantOptions: parsed.data.variant_options?.map((o) => ({ name: o.name, values: o.values })),
        variantEntries: parsed.data.variant_entries?.map((e) => ({
          options: e.options,
          pricePesewas: e.pricePesewas !== undefined ? BigInt(e.pricePesewas) : undefined,
          quantity: e.quantity,
          sku: e.sku ?? null,
        })),
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
        attributes:
          parsed.data.attributes !== undefined
            ? normalizeAttributes(parsed.data.attributes)
            : undefined,
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
  .post("/:id/appeal", async (c) => {
    const parsed = z.object({ message: z.string().trim().min(1).max(1000) }).safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const sellerId = sellerIdOrThrow(c)
    const owned = await c.get("repo").listVendorProducts(sellerId)
    const product = owned.find((p) => p.product.id === c.req.param("id"))?.product
    if (!product) throw new HTTPException(404, { message: "product not found" })
    if (product.status !== "rejected") {
      throw new HTTPException(400, { message: "only rejected products can be appealed" })
    }
    const existing = await c.get("appeals").openAppealForProduct(product.id)
    if (existing) throw new HTTPException(409, { message: "an appeal is already open" })
    const appeal = await c.get("appeals").openAppeal({
      productId: product.id,
      sellerId,
      message: parsed.data.message,
    })
    return c.json({ appeal }, 201)
  })
  .get("/appeals/mine", async (c) => {
    const sellerId = sellerIdOrThrow(c)
    const appeals = await c.get("appeals").listBySeller(sellerId)
    return c.json({ appeals })
  })
  .delete("/:id", async (c) => {
    const sellerId = sellerIdOrThrow(c)
    const productId = c.req.param("id")
    const owned = (await c.get("repo").listVendorProducts(sellerId)).some((p) => p.product.id === productId)
    if (!owned) throw new HTTPException(404, { message: "product not found" })
    if (await c.get("checkoutRepo").productHasOrders(productId)) {
      throw new HTTPException(409, { message: "order history exists - archive combinations instead of deleting" })
    }
    const deleted = await c.get("repo").deleteVendorProduct(sellerId, productId)
    if (!deleted) throw new HTTPException(404, { message: "product not found" })
    return c.json({ deleted: true })
  })
  .patch("/:id/variants/:variantId", async (c) => {
    const parsed = VariantPatchBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const sellerId = sellerIdOrThrow(c)
    const productId = c.req.param("id")
    const variantId = c.req.param("variantId")
    // Before-image for stock/price journeys (best effort; alerts never fail writes).
    const before = await c
      .get("repo")
      .listVendorProducts(sellerId)
      .then((items) => {
        const item = items.find((p) => p.product.id === productId)
        const combo = item?.variants.find((v) => v.variant.id === variantId)
        if (!item || !combo) return null
        return {
          offerId: combo.offer.id,
          title: item.product.title,
          pricePesewas: BigInt(combo.offer.pricePesewas),
          onHand: combo.offer.onHand,
          active: combo.offer.active,
        }
      })
      .catch(() => null)
    try {
      const updated = await c.get("repo").updateProductVariant(
        sellerId,
        productId,
        variantId,
        {
          pricePesewas:
            parsed.data.pricePesewas !== undefined ? BigInt(parsed.data.pricePesewas) : undefined,
          onHand: parsed.data.onHand,
          active: parsed.data.active,
          condition: parsed.data.condition,
          compareAtPesewas:
            parsed.data.compareAtPesewas !== undefined && parsed.data.compareAtPesewas !== null
              ? BigInt(parsed.data.compareAtPesewas)
              : (parsed.data.compareAtPesewas ?? undefined),
          compareAtProvenance: parsed.data.compareAtProvenance,
          fulfillmentOrigin: parsed.data.fulfillmentOrigin,
          warrantyRef: parsed.data.warrantyRef,
          returnsRef: parsed.data.returnsRef,
          deliveryPromise: parsed.data.deliveryPromise,
        },
      )
      if (!updated) throw new HTTPException(404, { message: "product or combination not found" })
      if (before) {
        const afterCombo = updated.variants.find((v) => v.variant.id === variantId)
        if (afterCombo) {
          void fireStockPriceAlerts(c, {
            offerId: afterCombo.offer.id,
            title: before.title,
            before,
            after: {
              pricePesewas: BigInt(afterCombo.offer.pricePesewas),
              onHand: afterCombo.offer.onHand,
              active: afterCombo.offer.active,
            },
          })
        }
      }
      return c.json(updated)
    } catch (err) {
      if (err instanceof HTTPException) throw err
      mapCatalogWriteError(err)
    }
  })
  .post("/:id/options", async (c) => {
    const parsed = AddOptionBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const sellerId = sellerIdOrThrow(c)
    try {
      const updated = await c.get("repo").addProductOptionValue(sellerId, c.req.param("id"), {
        optionId: parsed.data.optionId,
        optionName: parsed.data.optionName,
        value: parsed.data.value,
        existingValue: parsed.data.existingValue,
      })
      if (!updated) throw new HTTPException(404, { message: "product not found" })
      return c.json(updated)
    } catch (err) {
      if (err instanceof HTTPException) throw err
      mapCatalogWriteError(err)
    }
  })
  .patch("/:id/values/:valueId", async (c) => {
    const parsed = z.object({ imageUrl: ImageUrl.nullable() }).safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const sellerId = sellerIdOrThrow(c)
    const updated = await c.get("repo").setOptionValueImage(
      sellerId,
      c.req.param("id"),
      c.req.param("valueId"),
      parsed.data.imageUrl,
    )
    if (!updated) throw new HTTPException(404, { message: "product or value not found" })
    return c.json(updated)
  })
  /**
   * Phase 1B — seller enrichment of product identity (brand/model/…).
   * Never promotes confidence; matching stays a reviewed workflow.
   */
  .patch("/:id/identity", async (c) => {
    const parsed = IdentityBody.refine((v) => Object.keys(v).length > 0, {
      message: "empty patch",
    }).safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const sellerId = sellerIdOrThrow(c)
    try {
      const identity = await c
        .get("repo")
        .updateProductIdentity(c.req.param("id"), parsed.data, { sellerId })
      if (!identity) throw new HTTPException(404, { message: "product not found" })
      return c.json({ identity })
    } catch (err) {
      if (err instanceof HTTPException) throw err
      mapCatalogWriteError(err)
    }
  })
  /**
   * Phase 1C — seller writes typed attribute values against definitions.
   * Unknown definitions and invalid values are 400, never silent drops.
   */
  .put("/:id/attributes", async (c) => {
    const parsed = z.array(AttributeValueBody).min(1).max(100).safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const sellerId = sellerIdOrThrow(c)
    try {
      const values = await c
        .get("repo")
        .setProductAttributeValues(c.req.param("id"), parsed.data, { sellerId })
      return c.json({ values })
    } catch (err) {
      if (err instanceof HTTPException) throw err
      mapCatalogWriteError(err)
    }
  })
  .get("/:id/attributes", async (c) => {
    const sellerId = sellerIdOrThrow(c)
    const owned = (await c.get("repo").listVendorProducts(sellerId)).some(
      (p) => p.product.id === c.req.param("id"),
    )
    if (!owned) throw new HTTPException(404, { message: "product not found" })
    return c.json({
      values: await c.get("repo").listProductAttributeValues(c.req.param("id")),
      definitions: await c.get("repo").listAttributeDefinitions(),
    })
  })
