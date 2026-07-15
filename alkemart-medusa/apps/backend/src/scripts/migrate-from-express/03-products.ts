/**
 * ETL 03 — Express `products` → Medusa products (variant, price, inventory, SC, vendor link).
 *
 * Idempotency: Medusa handle = Express slug.
 *
 * Money:
 *   Express price_pesewas (int) → Medusa amount = pricePesewas / 100 (GHS major).
 *   See ./money.ts and seed-ghana verification notes.
 *
 * Prerequisites:
 *   - bootstrap-commerce-context (region, SC, Accra stock location)
 *   - 01-categories, 02-vendors preferred (products still migrate without vendor link)
 *
 * Usage:
 *   npx medusa exec ./src/scripts/migrate-from-express/03-products.ts
 *
 * Production: ALLOW_EXPRESS_MIGRATE=true
 */

import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  batchLinkProductsToCategoryWorkflow,
  createInventoryItemsWorkflow,
  createInventoryLevelsWorkflow,
  createLinksWorkflow,
  createProductsWorkflow,
  linkProductsToSalesChannelWorkflow,
  updateInventoryLevelsWorkflow,
  updateProductsWorkflow,
  upsertVariantPricesWorkflow,
} from "@medusajs/medusa/core-flows"
import { MARKETPLACE_MODULE } from "../../modules/marketplace"
import {
  assertExpressMigrateAllowed,
  REGION_CURRENCY,
  SALES_CHANNEL_NAME,
  STOCK_LOCATION_NAME,
} from "./guard"
import { queryExpress, redactedDbTarget } from "./db-source"
import { pesewasToMedusaAmount } from "./money"

type ExpressProductRow = {
  id: number
  slug: string
  title: string
  brand: string | null
  description: string | null
  price_pesewas: number
  compare_at_pesewas: number | null
  stock: number
  reserved_stock: number
  tag: string | null
  attributes: Record<string, unknown> | null
  is_active: boolean
  vendor_id: number
  category_id: number
  vendor_slug: string
  vendor_name: string
  category_slug: string
  category_name: string
}

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>
    for (const key of Object.keys(obj)) {
      if (Array.isArray(obj[key])) return obj[key] as T[]
    }
  }
  return []
}

async function ensureVariantGhsPrice(
  container: ExecArgs["container"],
  query: any,
  opts: {
    productId: string
    variantId: string
    amount: number
    currencyCode: string
  }
) {
  let hasPriceSet = false
  try {
    const { data } = await query.graph({
      entity: "product_variant_price_set",
      fields: ["variant_id", "price_set_id"],
      filters: { variant_id: opts.variantId },
    })
    hasPriceSet = asArray(data).length > 0
  } catch {
    hasPriceSet = false
  }

  if (!hasPriceSet) {
    try {
      const { data } = await query.graph({
        entity: "product_variant",
        fields: ["id", "price_set.id"],
        filters: { id: opts.variantId },
      })
      const rows = asArray<{ id: string; price_set?: { id?: string } | null }>(
        data
      )
      hasPriceSet = Boolean(rows[0]?.price_set?.id)
    } catch {
      hasPriceSet = false
    }
  }

  await upsertVariantPricesWorkflow(container).run({
    input: {
      variantPrices: [
        {
          variant_id: opts.variantId,
          product_id: opts.productId,
          prices: [
            {
              amount: opts.amount,
              currency_code: opts.currencyCode,
            },
          ],
        },
      ],
      previousVariantIds: hasPriceSet ? [opts.variantId] : [],
    },
  })
}

async function resolveMarketplaceService(container: ExecArgs["container"]) {
  for (const key of [MARKETPLACE_MODULE, "marketplaceModuleService"] as const) {
    try {
      return container.resolve(key) as {
        listVendors: (
          filters?: Record<string, unknown>,
          config?: Record<string, unknown>
        ) => Promise<any[]>
      }
    } catch {
      // next
    }
  }
  return null
}

async function migrateProducts({ container }: ExecArgs) {
  assertExpressMigrateAllowed("03-products")

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const productModule = container.resolve(Modules.PRODUCT)
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL)
  const stockLocationModule = container.resolve(Modules.STOCK_LOCATION)
  const inventoryModule = container.resolve(Modules.INVENTORY)
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT)

  logger.info("=== migrate-from-express 03-products ===")
  logger.info(`Express source: ${redactedDbTarget()}`)
  logger.info(
    "Money: Express price_pesewas / 100 → Medusa GHS major (see money.ts)"
  )

  // --- Commerce context (must exist from bootstrap) ---
  let salesChannel = (
    await salesChannelModule.listSalesChannels(
      { name: SALES_CHANNEL_NAME },
      { take: 1 }
    )
  )[0]
  if (!salesChannel) {
    const all = await salesChannelModule.listSalesChannels({}, { take: 5 })
    salesChannel = all[0]
  }
  if (!salesChannel) {
    throw new Error(
      "No sales channel found — run bootstrap-commerce-context.ts first"
    )
  }
  logger.info(
    `Sales channel: ${salesChannel.name} id=${salesChannel.id}`
  )

  let stockLocation = (
    await stockLocationModule.listStockLocations(
      { name: STOCK_LOCATION_NAME },
      { take: 1 }
    )
  )[0]
  if (!stockLocation) {
    const all = await stockLocationModule.listStockLocations({}, { take: 20 })
    stockLocation =
      all.find((l) => /accra/i.test(l.name ?? "")) ?? all[0]
  }
  if (!stockLocation) {
    throw new Error(
      "No stock location found — run bootstrap-commerce-context.ts first"
    )
  }
  logger.info(
    `Stock location: ${stockLocation.name} id=${stockLocation.id}`
  )

  // Shipping profile (optional but preferred)
  let shippingProfileId: string | undefined
  try {
    const { data: profiles } = await query.graph({
      entity: "shipping_profile",
      fields: ["id", "name", "type"],
    })
    const list = asArray<{ id: string; name?: string; type?: string }>(profiles)
    const preferred =
      list.find((p) => /default/i.test(p.name ?? "")) ??
      list.find((p) => p.type === "default") ??
      list[0]
    shippingProfileId = preferred?.id
    if (shippingProfileId) {
      logger.info(`Shipping profile: ${preferred?.name} id=${shippingProfileId}`)
    }
  } catch (err: any) {
    logger.warn(`Shipping profile query: ${err?.message ?? err}`)
  }
  if (!shippingProfileId) {
    try {
      const created = await fulfillmentModule.createShippingProfiles({
        name: "Default Shipping Profile",
        type: "default",
      })
      shippingProfileId = Array.isArray(created) ? created[0]?.id : created?.id
    } catch {
      // products can still be created without shipping profile in some setups
    }
  }

  // Category handle map
  const categoryByHandle = new Map<string, string>()
  try {
    const cats = await productModule.listProductCategories({}, { take: 1000 })
    for (const c of cats) {
      if (c.handle) categoryByHandle.set(c.handle, c.id)
    }
    logger.info(`Loaded ${cats.length} Medusa categories for linking`)
  } catch (err: any) {
    logger.warn(`Category list failed: ${err?.message ?? err}`)
  }

  // Vendor slug map
  const vendorBySlug = new Map<string, string>()
  const marketplace = await resolveMarketplaceService(container)
  if (marketplace) {
    try {
      const vendors = await marketplace.listVendors({}, { take: 1000 })
      for (const v of vendors ?? []) {
        if (v.slug) vendorBySlug.set(v.slug, v.id)
      }
      logger.info(`Loaded ${vendorBySlug.size} marketplace vendors for linking`)
    } catch (err: any) {
      logger.warn(`Vendor list failed: ${err?.message ?? err}`)
    }
  } else {
    logger.warn("marketplace module unavailable — vendor-product links skipped")
  }

  // --- Read Express ---
  let rows: ExpressProductRow[]
  try {
    rows = await queryExpress<ExpressProductRow>(
      `SELECT
         p.id,
         p.slug,
         p.title,
         p.brand,
         p.description,
         p.price_pesewas,
         p.compare_at_pesewas,
         p.stock,
         p.reserved_stock,
         p.tag,
         p.attributes,
         p.is_active,
         p.vendor_id,
         p.category_id,
         v.slug AS vendor_slug,
         v.name AS vendor_name,
         c.slug AS category_slug,
         c.name AS category_name
       FROM products p
       JOIN vendors v ON v.id = p.vendor_id
       JOIN categories c ON c.id = p.category_id
       WHERE p.is_active = true
       ORDER BY p.id ASC`
    )
  } catch (err: any) {
    const msg = err?.message ?? String(err)
    if (/relation ["']?products["']? does not exist/i.test(msg)) {
      logger.info(
        "Express table `products` does not exist — nothing to migrate (exit 0)"
      )
      return
    }
    throw err
  }

  logger.info(`Read ${rows.length} active Express products`)

  if (rows.length === 0) {
    logger.info("no source products — nothing to migrate")
    return
  }

  type Migrated = {
    handle: string
    productId: string
    variantId: string
    amount: number
    stock: number
  }
  const migrated: Migrated[] = []

  let created = 0
  let updated = 0
  let skipped = 0
  let errors = 0

  for (const row of rows) {
    const handle = (row.slug || "").trim()
    if (!handle) {
      logger.warn(`Skip product id=${row.id}: empty slug`)
      skipped++
      continue
    }

    const amount = pesewasToMedusaAmount(Number(row.price_pesewas))
    const stock = Math.max(0, Number(row.stock) || 0)
    const categoryId = categoryByHandle.get(row.category_slug)
    const categoryIds = categoryId ? [categoryId] : []
    const description =
      row.description ||
      [row.brand, row.tag].filter(Boolean).join(" · ") ||
      undefined

    try {
      const existing = (
        await productModule.listProducts(
          { handle },
          { take: 1, relations: ["variants", "categories"] }
        )
      )[0]

      let productId: string
      let variantId: string
      let isNew = false

      if (existing) {
        productId = existing.id
        const variants = (existing as any).variants ?? []
        variantId = variants[0]?.id

        if (!variantId) {
          logger.warn(
            `Product ${handle} has no variants — cannot update prices/inventory`
          )
          skipped++
          continue
        }

        try {
          await updateProductsWorkflow(container).run({
            input: {
              products: [
                {
                  id: productId,
                  status: ProductStatus.PUBLISHED,
                  title: row.title,
                  description,
                  category_ids: categoryIds.length ? categoryIds : undefined,
                  sales_channels: [{ id: salesChannel.id }],
                  shipping_profile_id: shippingProfileId ?? undefined,
                  metadata: {
                    express_product_id: row.id,
                    express_vendor_slug: row.vendor_slug,
                    brand: row.brand,
                    tag: row.tag,
                    compare_at_pesewas: row.compare_at_pesewas,
                    attributes: row.attributes,
                  },
                },
              ],
            },
          })
        } catch (err: any) {
          logger.warn(
            `updateProducts ${handle}: ${err?.message?.slice(0, 160) ?? err}`
          )
        }

        await ensureVariantGhsPrice(container, query, {
          productId,
          variantId,
          amount,
          currencyCode: REGION_CURRENCY,
        })

        if (categoryId) {
          try {
            await batchLinkProductsToCategoryWorkflow(container).run({
              input: {
                id: categoryId,
                add: [productId],
              },
            })
          } catch {
            // already linked
          }
        }

        try {
          await linkProductsToSalesChannelWorkflow(container).run({
            input: {
              id: salesChannel.id,
              add: [productId],
            },
          })
        } catch {
          // already linked
        }

        updated++
        logger.info(
          `Updated product ${handle} id=${productId} amount=${amount} ${REGION_CURRENCY} stock=${stock}`
        )
      } else {
        isNew = true
        const { result } = await createProductsWorkflow(container).run({
          input: {
            products: [
              {
                title: row.title,
                description,
                handle,
                status: ProductStatus.PUBLISHED,
                category_ids: categoryIds,
                shipping_profile_id: shippingProfileId,
                sales_channels: [{ id: salesChannel.id }],
                metadata: {
                  express_product_id: row.id,
                  express_vendor_slug: row.vendor_slug,
                  brand: row.brand,
                  tag: row.tag,
                  compare_at_pesewas: row.compare_at_pesewas,
                  attributes: row.attributes,
                },
                options: [
                  {
                    title: "Default",
                    values: ["Default"],
                  },
                ],
                variants: [
                  {
                    title: "Default",
                    sku: handle,
                    manage_inventory: true,
                    allow_backorder: false,
                    options: {
                      Default: "Default",
                    },
                    prices: [
                      {
                        amount,
                        currency_code: REGION_CURRENCY,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        })

        const createdProduct = result[0]
        productId = createdProduct.id
        variantId = (createdProduct as any).variants?.[0]?.id

        if (!variantId) {
          const reloaded = (
            await productModule.listProducts(
              { id: productId },
              { take: 1, relations: ["variants"] }
            )
          )[0]
          variantId = (reloaded as any)?.variants?.[0]?.id
        }

        if (!variantId) {
          logger.warn(`Created product ${handle} but no variant id — skip inventory`)
          created++
          continue
        }

        created++
        logger.info(
          `Created product ${handle} id=${productId} amount=${amount} ${REGION_CURRENCY} stock=${stock}`
        )
      }

      // Vendor link (marketplace ↔ product)
      const vendorId = vendorBySlug.get(row.vendor_slug)
      if (vendorId) {
        try {
          await link.create({
            [MARKETPLACE_MODULE]: { vendor_id: vendorId },
            [Modules.PRODUCT]: { product_id: productId },
          })
          logger.info(
            `Linked vendor slug=${row.vendor_slug} → product ${handle}`
          )
        } catch (err: any) {
          // already linked is fine
          const msg = String(err?.message ?? err)
          if (!/already|exist|duplicate/i.test(msg)) {
            logger.warn(
              `Vendor link ${row.vendor_slug}→${handle}: ${msg.slice(0, 120)}`
            )
          }
        }
      } else if (isNew) {
        logger.warn(
          `No marketplace vendor for slug=${row.vendor_slug} (product ${handle})`
        )
      }

      migrated.push({ handle, productId, variantId, amount, stock })
    } catch (err: any) {
      errors++
      logger.error(
        `Product ${handle} failed: ${err?.message?.slice(0, 240) ?? err}`
      )
    }
  }

  // --- Inventory levels at Accra ---
  logger.info("Setting inventory levels…")

  async function resolveInventoryItemId(
    variantId: string,
    handle: string
  ): Promise<string | undefined> {
    try {
      const { data: variantRows } = await query.graph({
        entity: "product_variant",
        fields: [
          "id",
          "inventory_items.inventory_item_id",
          "inventory_items.id",
        ],
        filters: { id: variantId },
      })
      const rows = asArray<{
        id: string
        inventory_items?: Array<{
          inventory_item_id?: string
          id?: string
        }>
      }>(variantRows)
      const fromLink =
        rows[0]?.inventory_items?.[0]?.inventory_item_id ??
        rows[0]?.inventory_items?.[0]?.id
      if (fromLink) return fromLink
    } catch {
      // fall through
    }

    const bySku = await inventoryModule.listInventoryItems(
      { sku: handle },
      { take: 1 }
    )
    return bySku[0]?.id
  }

  for (const p of migrated) {
    try {
      let inventoryItemId = await resolveInventoryItemId(p.variantId, p.handle)

      if (!inventoryItemId) {
        const { result: createdItems } = await createInventoryItemsWorkflow(
          container
        ).run({
          input: {
            items: [
              {
                sku: p.handle,
                title: p.handle,
                requires_shipping: true,
              },
            ],
          },
        })
        inventoryItemId = createdItems[0]?.id

        if (inventoryItemId) {
          await createLinksWorkflow(container).run({
            input: [
              {
                [Modules.PRODUCT]: { variant_id: p.variantId },
                [Modules.INVENTORY]: { inventory_item_id: inventoryItemId },
                data: { required_quantity: 1 },
              },
            ],
          })
        }
      }

      if (!inventoryItemId) {
        logger.warn(
          `No inventory item for ${p.handle} — skip level`
        )
        continue
      }

      const existingLevels = await inventoryModule.listInventoryLevels(
        {
          inventory_item_id: inventoryItemId,
          location_id: stockLocation.id,
        },
        { take: 1 }
      )

      if (existingLevels.length > 0) {
        await updateInventoryLevelsWorkflow(container).run({
          input: {
            updates: [
              {
                id: existingLevels[0].id,
                inventory_item_id: inventoryItemId,
                location_id: stockLocation.id,
                stocked_quantity: p.stock,
              },
            ],
          },
        })
      } else {
        await createInventoryLevelsWorkflow(container).run({
          input: {
            inventory_levels: [
              {
                inventory_item_id: inventoryItemId,
                location_id: stockLocation.id,
                stocked_quantity: p.stock,
              },
            ],
          },
        })
      }
      logger.info(
        `Inventory ${p.handle}: stocked_quantity=${p.stock} @ ${stockLocation.id}`
      )
    } catch (err: any) {
      logger.warn(
        `Inventory for ${p.handle} failed: ${err?.message?.slice(0, 200) ?? err}`
      )
    }
  }

  logger.info("=== 03-products complete ===")
  logger.info(
    `counts: read=${rows.length} created=${created} updated=${updated} skipped=${skipped} errors=${errors}`
  )
}

export default migrateProducts
