/**
 * DEV / CI FIXTURE ONLY — Deterministic Ghana seed for Alkemart local/dev.
 *
 * **Production catalog must come from ETL (migrate-from-express), not this seed.**
 * Refused when `NODE_ENV=production`. Prefer
 * `bootstrap-commerce-context.ts` for infrastructure without catalog.
 *
 * Creates / reuses:
 *   - Region "Ghana" (currency ghs, country gh)
 *   - Sales channel "Alkemart Storefront" (never creates a second Default)
 *   - Stock location "Alkemart Accra Warehouse" linked to the sales channel
 *   - Default shipping profile
 *   - 8 top-level categories + Smartphones under Electronics
 *   - 12 catalog products with GHS prices, category links, sales-channel
 *     membership, and inventory levels
 *
 * Money units
 * -----------
 * Product catalog is authored in GHS major units (`priceGhs`, e.g. 1899.00).
 *
 * Verified against Medusa v2.17 Store API: `calculated_price.calculated_amount`
 * is in **major currency units** (GHS), not pesewas. Seeding with
 * `Math.round(priceGhs * 100)` produced 100x-inflated amounts (e.g. 189900
 * for a GHS 1899 phone). Therefore `USE_PESEWAS = false` and amounts are
 * written as major GHS values.
 *
 * Alkemart app-layer invariant may still use integer pesewas when talking to
 * non-Medusa services — convert at the boundary:
 *   medusa_amount_ghs * 100  →  pesewas
 *   pesewas / 100            →  medusa_amount_ghs
 *
 * Usage (development / CI only):
 *   npx medusa exec ./src/scripts/seed-ghana.ts
 *
 * Idempotent: re-running reuses existing region / channel / location /
 * categories / products-by-handle and UPDATES prices, categories, sales
 * channels, and inventory rather than skipping or duplicating.
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
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  linkProductsToSalesChannelWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateInventoryLevelsWorkflow,
  updateProductsWorkflow,
  upsertVariantPricesWorkflow,
} from "@medusajs/medusa/core-flows"

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/**
 * When true, store `amount = priceGhs * 100` (pesewas).
 * Medusa v2.17 Store API expects major GHS units → keep false.
 * (Verified live: pesewas produced calculated_amount 100x too high.)
 */
const USE_PESEWAS = false

const REGION_NAME = "Ghana"
const REGION_CURRENCY = "ghs"
const REGION_COUNTRY = "gh"

const SALES_CHANNEL_NAME = "Alkemart Storefront"
const SALES_CHANNEL_DESCRIPTION = "Alkemart customer-facing storefront channel"

const STOCK_LOCATION_NAME = "Alkemart Accra Warehouse"
const SHIPPING_PROFILE_NAME = "Default Shipping Profile"

/**
 * Convert a GHS major-unit price to the amount stored on the price set.
 * When USE_PESEWAS is true → integer pesewas; otherwise major units.
 */
function toAmount(priceGhs: number): number {
  return USE_PESEWAS ? Math.round(priceGhs * 100) : priceGhs
}

function toHandle(name: string | null | undefined): string {
  return String(name ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

// Top-level categories (stable handles). Smartphones is nested under Electronics.
const CATEGORIES: Array<{ name: string; handle: string }> = [
  { name: "Electronics", handle: "electronics" },
  { name: "Fashion", handle: "fashion" },
  { name: "Home & Garden", handle: "home-garden" },
  { name: "Beauty & Health", handle: "beauty-health" },
  { name: "Groceries", handle: "groceries" },
  { name: "Phones & Tablets", handle: "phones-tablets" },
  { name: "Fashion - Men", handle: "fashion-men" },
  { name: "Fashion - Women", handle: "fashion-women" },
]

const SMARTPHONES = {
  name: "Smartphones",
  handle: "smartphones",
  parentHandle: "electronics",
}

type CatalogProduct = {
  title: string
  description: string
  handle: string
  /** Category name (must match CATEGORIES[].name) */
  category: string
  priceGhs: number
  stock: number
  thumbnail: string
}

const CATALOG: CatalogProduct[] = [
  {
    title: "Samsung Galaxy A15 - Dual SIM 128GB",
    description:
      "Samsung Galaxy A15 with 6.5-inch Super AMOLED display, 5000mAh battery, and triple camera system. Dual SIM, 128GB storage.",
    handle: "samsung-galaxy-a15-128gb",
    category: "Phones & Tablets",
    priceGhs: 1899.0,
    stock: 45,
    thumbnail: "https://placehold.co/600x600?text=Samsung+Galaxy+A15",
  },
  {
    title: "Infinix Hot 40 Pro - 256GB",
    description:
      "Infinix Hot 40 Pro with 6.78-inch display, 108MP camera, 5000mAh battery. 256GB storage, 8GB RAM.",
    handle: "infinix-hot-40-pro-256gb",
    category: "Phones & Tablets",
    priceGhs: 1499.0,
    stock: 62,
    thumbnail: "https://placehold.co/600x600?text=Infinix+Hot+40+Pro",
  },
  {
    title: 'Hisense 43" Full HD Smart TV',
    description:
      "Hisense 43-inch Full HD Smart TV with built-in WiFi, Netflix, YouTube. DLED display technology.",
    handle: "hisense-43-smart-tv",
    category: "Electronics",
    priceGhs: 2999.0,
    stock: 18,
    thumbnail: "https://placehold.co/600x600?text=Hisense+43+Smart+TV",
  },
  {
    title: "HP Laptop 15s - Intel Core i5, 8GB RAM, 512GB SSD",
    description:
      "HP 15s-fq5000 series laptop with Intel Core i5-1235U, 8GB DDR4 RAM, 512GB NVMe SSD, 15.6-inch FHD display.",
    handle: "hp-laptop-15s-i5-512gb",
    category: "Electronics",
    priceGhs: 5499.0,
    stock: 12,
    thumbnail: "https://placehold.co/600x600?text=HP+Laptop+15s",
  },
  {
    title: "Men's Polo T-Shirt - Cotton Blend",
    description:
      "Comfortable cotton-blend polo t-shirt for men. Available in multiple colors. Machine washable.",
    handle: "mens-polo-tshirt",
    category: "Fashion - Men",
    priceGhs: 89.0,
    stock: 150,
    thumbnail: "https://placehold.co/600x600?text=Mens+Polo+TShirt",
  },
  {
    title: "Women's Ankara Print Dress",
    description:
      "Beautiful Ankara print dress with modern cut. Perfect for casual and formal occasions.",
    handle: "womens-ankara-dress",
    category: "Fashion - Women",
    priceGhs: 249.0,
    stock: 35,
    thumbnail: "https://placehold.co/600x600?text=Ankara+Dress",
  },
  {
    title: "Philips Air Fryer - 4.1L",
    description:
      "Philips Essential Airfryer with Rapid Air technology. 4.1L capacity, digital controls, 7 preset cooking functions.",
    handle: "philips-airfryer-4l",
    category: "Home & Garden",
    priceGhs: 1299.0,
    stock: 22,
    thumbnail: "https://placehold.co/600x600?text=Philips+Airfryer",
  },
  {
    title: "Anker PowerCore 20000mAh Power Bank",
    description:
      "Anker PowerCore 20000mAh portable charger with dual USB ports, PowerIQ technology. Fast charging for phones and tablets.",
    handle: "anker-powerbank-20000mah",
    category: "Electronics",
    priceGhs: 349.0,
    stock: 80,
    thumbnail: "https://placehold.co/600x600?text=Anker+PowerBank",
  },
  {
    title: "Dettol Antibacterial Soap - 6 Pack",
    description:
      "Dettol antibacterial bar soap for protection against bacteria. Gentle on skin. 6-pack value bundle.",
    handle: "dettol-soap-6pack",
    category: "Beauty & Health",
    priceGhs: 45.0,
    stock: 200,
    thumbnail: "https://placehold.co/600x600?text=Dettol+Soap+6pk",
  },
  {
    title: "Indomie Instant Noodles - 40 Pack",
    description:
      "Indomie instant noodles variety pack. 40 packs of delicious quick meals. Multiple flavors included.",
    handle: "indomie-noodles-40pack",
    category: "Groceries",
    priceGhs: 120.0,
    stock: 100,
    thumbnail: "https://placehold.co/600x600?text=Indomie+40+Pack",
  },
  {
    title: "JBL Tune 510BT Wireless Headphones",
    description:
      "JBL Tune 510BT on-ear wireless headphones with JBL Pure Bass sound, 40-hour battery life, and multipoint connection.",
    handle: "jbl-tune-510bt",
    category: "Electronics",
    priceGhs: 499.0,
    stock: 30,
    thumbnail: "https://placehold.co/600x600?text=JBL+Tune+510BT",
  },
  {
    title: "Xiaomi Redmi Note 13 - 128GB",
    description:
      "Xiaomi Redmi Note 13 with 6.67-inch AMOLED display, 108MP camera, 5000mAh battery, 33W fast charging.",
    handle: "xiaomi-redmi-note-13-128gb",
    category: "Phones & Tablets",
    priceGhs: 1699.0,
    stock: 55,
    thumbnail: "https://placehold.co/600x600?text=Xiaomi+Redmi+Note+13",
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/**
 * Ensure a variant has a GHS price.
 *
 * Variants created via the raw product module (old seed) have no price-set
 * link — `updateProductVariantsWorkflow` then throws. `upsertVariantPricesWorkflow`
 * creates price sets when the variant is NOT listed in `previousVariantIds`,
 * and updates when it is.
 */
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
    // entity name may differ — treat as missing
    hasPriceSet = false
  }

  // Also try remote query entry point style via graph on variant
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
      // Existing → update path; missing → create price set + link
      previousVariantIds: hasPriceSet ? [opts.variantId] : [],
    },
  })
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function seedGhanaData({ container }: ExecArgs) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "seed-ghana is a DEV FIXTURE only — refused in production. Use ETL migrate-from-express for real data."
    )
  }

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const regionModule = container.resolve(Modules.REGION)
  const productModule = container.resolve(Modules.PRODUCT)
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL)
  const stockLocationModule = container.resolve(Modules.STOCK_LOCATION)
  const inventoryModule = container.resolve(Modules.INVENTORY)
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT)

  logger.info("=== Alkemart Ghana seed (deterministic, workflow-based) ===")
  logger.info(
    `Money mode: ${USE_PESEWAS ? "integer pesewas (priceGhs * 100)" : "major GHS units"}`
  )

  // -------------------------------------------------------------------------
  // 1. Region: Ghana / ghs / gh
  // -------------------------------------------------------------------------
  let region = (
    await regionModule.listRegions({ name: REGION_NAME }, { take: 1 })
  )[0]

  if (!region) {
    // Also match by currency if renamed
    const byCurrency = await regionModule.listRegions(
      { currency_code: REGION_CURRENCY },
      { take: 5 }
    )
    region = byCurrency.find((r) => /ghana/i.test(r.name)) ?? byCurrency[0]
  }

  if (region) {
    logger.info(`Region reused: ${region.name} id=${region.id}`)
  } else {
    const { result } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: REGION_NAME,
            currency_code: REGION_CURRENCY,
            countries: [REGION_COUNTRY],
            payment_providers: ["pp_system_default"],
            metadata: { timezone: "Africa/Accra" },
          },
        ],
      },
    })
    region = result[0]
    logger.info(`Region created: ${region.name} id=${region.id}`)
  }

  // -------------------------------------------------------------------------
  // 2. Sales channel: only ensure "Alkemart Storefront" (do not create Default)
  // -------------------------------------------------------------------------
  let salesChannel = (
    await salesChannelModule.listSalesChannels(
      { name: SALES_CHANNEL_NAME },
      { take: 1 }
    )
  )[0]

  if (salesChannel) {
    logger.info(
      `Sales channel reused: ${salesChannel.name} id=${salesChannel.id}`
    )
  } else {
    const { result } = await createSalesChannelsWorkflow(container).run({
      input: {
        salesChannelsData: [
          {
            name: SALES_CHANNEL_NAME,
            description: SALES_CHANNEL_DESCRIPTION,
          },
        ],
      },
    })
    salesChannel = result[0]
    logger.info(
      `Sales channel created: ${salesChannel.name} id=${salesChannel.id}`
    )
  }

  // -------------------------------------------------------------------------
  // 3. Stock location + link to sales channel
  // -------------------------------------------------------------------------
  let stockLocation = (
    await stockLocationModule.listStockLocations(
      { name: STOCK_LOCATION_NAME },
      { take: 1 }
    )
  )[0]

  if (stockLocation) {
    logger.info(
      `Stock location reused: ${stockLocation.name} id=${stockLocation.id}`
    )
  } else {
    const { result } = await createStockLocationsWorkflow(container).run({
      input: {
        locations: [
          {
            name: STOCK_LOCATION_NAME,
            address: {
              city: "Accra",
              country_code: "gh",
              address_1: "Alkemart Fulfillment Center",
            },
          },
        ],
      },
    })
    stockLocation = result[0]
    logger.info(
      `Stock location created: ${stockLocation.name} id=${stockLocation.id}`
    )
  }

  try {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: {
        id: stockLocation.id,
        add: [salesChannel.id],
      },
    })
    logger.info(
      `Linked sales channel ${salesChannel.id} → stock location ${stockLocation.id}`
    )
  } catch (err: any) {
    // Already linked is fine
    logger.info(
      `Sales-channel↔stock-location link: ${err?.message?.slice(0, 120) ?? err}`
    )
  }

  // -------------------------------------------------------------------------
  // 4. Shipping profile (default)
  // -------------------------------------------------------------------------
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

    if (preferred) {
      shippingProfileId = preferred.id
      logger.info(
        `Shipping profile reused: ${preferred.name ?? preferred.id} id=${preferred.id}`
      )
    }
  } catch (err: any) {
    logger.warn(`Shipping profile query failed: ${err?.message ?? err}`)
  }

  if (!shippingProfileId) {
    try {
      const { result } = await createShippingProfilesWorkflow(container).run({
        input: {
          data: [
            {
              name: SHIPPING_PROFILE_NAME,
              type: "default",
            },
          ],
        },
      })
      shippingProfileId = result[0]?.id
      logger.info(`Shipping profile created: id=${shippingProfileId}`)
    } catch (err: any) {
      // Fallback: try fulfillment module directly
      try {
        const created = await fulfillmentModule.createShippingProfiles({
          name: SHIPPING_PROFILE_NAME,
          type: "default",
        })
        shippingProfileId = Array.isArray(created) ? created[0]?.id : created?.id
        logger.info(
          `Shipping profile created via module: id=${shippingProfileId}`
        )
      } catch (err2: any) {
        logger.warn(
          `Could not create shipping profile: ${err2?.message ?? err2}`
        )
      }
    }
  }

  // -------------------------------------------------------------------------
  // 5. Categories (stable handles) + Smartphones under Electronics
  // -------------------------------------------------------------------------
  const categoryByName: Record<string, { id: string; handle: string }> = {}
  const categoryByHandle: Record<string, { id: string; name: string }> = {}

  function rememberCategory(cat: {
    id: string
    name?: string | null
    handle?: string | null
  }) {
    if (!cat?.id) return
    const name = cat.name ?? ""
    const handle = cat.handle ?? toHandle(name)
    if (handle) categoryByHandle[handle] = { id: cat.id, name: name || handle }
    if (name) categoryByName[name] = { id: cat.id, handle }
  }

  // Bulk load (best-effort), then per-handle lookup for reliability
  try {
    const existingCats = await productModule.listProductCategories(
      {},
      { take: 500 }
    )
    for (const cat of existingCats) rememberCategory(cat)
    logger.info(`Loaded ${existingCats.length} existing product categories`)
  } catch (err: any) {
    logger.warn(`Bulk category list failed: ${err?.message ?? err}`)
  }

  for (const c of CATEGORIES) {
    if (categoryByHandle[c.handle] || categoryByName[c.name]) {
      const existing =
        categoryByHandle[c.handle] ??
        ({ id: categoryByName[c.name].id, name: c.name } as {
          id: string
          name: string
        })
      // Normalize both maps
      categoryByHandle[c.handle] = { id: existing.id, name: c.name }
      categoryByName[c.name] = { id: existing.id, handle: c.handle }
      logger.info(`Category reused: ${c.name} (${c.handle}) id=${existing.id}`)
      continue
    }

    // Explicit lookup by handle, then by name
    let found =
      (
        await productModule.listProductCategories(
          { handle: c.handle },
          { take: 1 }
        )
      )[0] ??
      (
        await productModule.listProductCategories({ name: c.name }, { take: 1 })
      )[0]

    if (found) {
      rememberCategory(found)
      categoryByHandle[c.handle] = { id: found.id, name: c.name }
      categoryByName[c.name] = {
        id: found.id,
        handle: found.handle ?? c.handle,
      }
      logger.info(`Category reused: ${c.name} (${c.handle}) id=${found.id}`)
      continue
    }

    try {
      const { result } = await createProductCategoriesWorkflow(container).run({
        input: {
          product_categories: [
            {
              name: c.name,
              handle: c.handle,
              is_active: true,
            },
          ],
        },
      })
      const cat = result[0]
      rememberCategory(cat)
      categoryByHandle[c.handle] = { id: cat.id, name: c.name }
      categoryByName[c.name] = { id: cat.id, handle: c.handle }
      logger.info(`Category created: ${c.name} (${c.handle}) id=${cat.id}`)
    } catch (err: any) {
      // Race / already-exists: re-list and reuse
      const retry =
        (
          await productModule.listProductCategories(
            { handle: c.handle },
            { take: 1 }
          )
        )[0] ??
        (
          await productModule.listProductCategories(
            { name: c.name },
            { take: 1 }
          )
        )[0]
      if (retry) {
        rememberCategory(retry)
        categoryByHandle[c.handle] = { id: retry.id, name: c.name }
        categoryByName[c.name] = {
          id: retry.id,
          handle: retry.handle ?? c.handle,
        }
        logger.info(
          `Category reused after create race: ${c.name} id=${retry.id}`
        )
      } else {
        logger.error(
          `Category ${c.name} create failed: ${err?.message ?? err}`
        )
      }
    }
  }

  // Smartphones under Electronics
  const electronics = categoryByHandle[SMARTPHONES.parentHandle]
  if (electronics) {
    let phones = categoryByHandle[SMARTPHONES.handle]
    if (!phones) {
      const found =
        (
          await productModule.listProductCategories(
            { handle: SMARTPHONES.handle },
            { take: 1 }
          )
        )[0] ??
        (
          await productModule.listProductCategories(
            { name: SMARTPHONES.name },
            { take: 1 }
          )
        )[0]
      if (found) {
        rememberCategory(found)
        phones = { id: found.id, name: SMARTPHONES.name }
        categoryByHandle[SMARTPHONES.handle] = phones
      }
    }

    if (phones) {
      logger.info(
        `Category reused: ${SMARTPHONES.name} id=${phones.id}`
      )
    } else {
      try {
        const { result } = await createProductCategoriesWorkflow(container).run(
          {
            input: {
              product_categories: [
                {
                  name: SMARTPHONES.name,
                  handle: SMARTPHONES.handle,
                  parent_category_id: electronics.id,
                  is_active: true,
                },
              ],
            },
          }
        )
        const cat = result[0]
        if (cat) {
          rememberCategory(cat)
          categoryByHandle[SMARTPHONES.handle] = {
            id: cat.id,
            name: SMARTPHONES.name,
          }
          categoryByName[SMARTPHONES.name] = {
            id: cat.id,
            handle: SMARTPHONES.handle,
          }
          logger.info(
            `Category created: ${SMARTPHONES.name} under Electronics id=${cat.id}`
          )
        }
      } catch (err: any) {
        logger.warn(
          `Smartphones category: ${err?.message ?? err}`
        )
      }
    }
  } else {
    logger.warn("Electronics category missing — cannot nest Smartphones")
  }

  // -------------------------------------------------------------------------
  // 6. Products: create or update (prices + category + SC + inventory)
  // -------------------------------------------------------------------------
  type SeededProduct = {
    id: string
    handle: string
    variantId: string
    amount: number
    priceGhs: number
    stock: number
  }
  const seeded: SeededProduct[] = []

  for (const item of CATALOG) {
    const amount = toAmount(item.priceGhs)
    const category = categoryByName[item.category]
    const categoryIds = category ? [category.id] : []

    try {
      const existing = (
        await productModule.listProducts(
          { handle: item.handle },
          { take: 1, relations: ["variants", "categories"] }
        )
      )[0]

      let productId: string
      let variantId: string

      if (existing) {
        productId = existing.id
        const variants = (existing as any).variants ?? []
        variantId = variants[0]?.id

        if (!variantId) {
          logger.warn(
            `Product ${item.handle} has no variants — cannot update prices`
          )
          continue
        }

        // Update product metadata / category / status / shipping profile
        try {
          await updateProductsWorkflow(container).run({
            input: {
              products: [
                {
                  id: productId,
                  status: ProductStatus.PUBLISHED,
                  title: item.title,
                  description: item.description,
                  thumbnail: item.thumbnail,
                  category_ids: categoryIds.length ? categoryIds : undefined,
                  sales_channels: [{ id: salesChannel.id }],
                  shipping_profile_id: shippingProfileId ?? undefined,
                },
              ],
            },
          })
        } catch (err: any) {
          logger.warn(
            `updateProducts ${item.handle}: ${err?.message?.slice(0, 160) ?? err}`
          )
        }

        // Create or update GHS price (handles variants with no price-set link)
        await ensureVariantGhsPrice(container, query, {
          productId,
          variantId,
          amount,
          currencyCode: REGION_CURRENCY,
        })

        // Ensure category link (batch is additive & idempotent-safe)
        if (category) {
          try {
            await batchLinkProductsToCategoryWorkflow(container).run({
              input: {
                id: category.id,
                add: [productId],
              },
            })
          } catch {
            // already linked
          }
        }

        // Ensure sales channel link
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

        logger.info(
          `Updated product ${item.handle} id=${productId} variant=${variantId} amount=${amount} ${REGION_CURRENCY}`
        )
      } else {
        // Create via workflow so pricing + inventory items are wired correctly
        const { result } = await createProductsWorkflow(container).run({
          input: {
            products: [
              {
                title: item.title,
                description: item.description,
                handle: item.handle,
                status: ProductStatus.PUBLISHED,
                thumbnail: item.thumbnail,
                images: [{ url: item.thumbnail }],
                category_ids: categoryIds,
                shipping_profile_id: shippingProfileId,
                sales_channels: [{ id: salesChannel.id }],
                options: [
                  {
                    title: "Default",
                    values: ["Default"],
                  },
                ],
                variants: [
                  {
                    title: "Default",
                    sku: item.handle,
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

        const created = result[0]
        productId = created.id
        variantId = (created as any).variants?.[0]?.id

        if (!variantId) {
          // Reload variants
          const reloaded = (
            await productModule.listProducts(
              { id: productId },
              { take: 1, relations: ["variants"] }
            )
          )[0]
          variantId = (reloaded as any)?.variants?.[0]?.id
        }

        logger.info(
          `Created product ${item.handle} id=${productId} variant=${variantId} amount=${amount} ${REGION_CURRENCY}`
        )
      }

      if (productId && variantId) {
        seeded.push({
          id: productId,
          handle: item.handle,
          variantId,
          amount,
          priceGhs: item.priceGhs,
          stock: item.stock,
        })
      }
    } catch (err: any) {
      logger.error(
        `Product ${item.handle} failed: ${err?.message ?? err}`
      )
    }
  }

  // -------------------------------------------------------------------------
  // 7. Inventory items + levels for every seeded variant at Accra warehouse
  // -------------------------------------------------------------------------
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

  for (const p of seeded) {
    try {
      let inventoryItemId = await resolveInventoryItemId(p.variantId, p.handle)

      // Legacy products (raw module seed) often have manage_inventory=true
      // but no inventory item / link. Create + link when missing.
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
          logger.info(
            `Inventory item created+linked ${p.handle} → ${inventoryItemId}`
          )
        }
      }

      if (!inventoryItemId) {
        logger.warn(
          `No inventory item for variant ${p.variantId} (${p.handle}) — skip level`
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
        logger.info(
          `Inventory updated ${p.handle}: ${p.stock} @ ${stockLocation.id}`
        )
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
        logger.info(
          `Inventory created ${p.handle}: ${p.stock} @ ${stockLocation.id}`
        )
      }
    } catch (err: any) {
      logger.warn(
        `Inventory for ${p.handle} failed: ${err?.message?.slice(0, 200) ?? err}`
      )
    }
  }

  // -------------------------------------------------------------------------
  // 8. Final summary / env hints
  // -------------------------------------------------------------------------
  const sample = seeded[0]
  logger.info("=== Seed complete ===")
  logger.info(`ALKEMART_REGION_ID=${region.id}`)
  logger.info(`ALKEMART_SALES_CHANNEL_ID=${salesChannel.id}`)
  logger.info(`ALKEMART_STOCK_LOCATION_ID=${stockLocation.id}`)
  if (shippingProfileId) {
    logger.info(`ALKEMART_SHIPPING_PROFILE_ID=${shippingProfileId}`)
  }
  if (sample) {
    logger.info(`# sample product`)
    logger.info(`ALKEMART_SAMPLE_PRODUCT_ID=${sample.id}`)
    logger.info(`ALKEMART_SAMPLE_VARIANT_ID=${sample.variantId}`)
    logger.info(
      `# expected calculated_price.calculated_amount ≈ ${sample.amount} (${USE_PESEWAS ? "pesewas" : "GHS major"} for GHS ${sample.priceGhs})`
    )
    logger.info(`# handle=${sample.handle}`)
  }
  logger.info(`# products seeded/updated: ${seeded.length}/${CATALOG.length}`)
  logger.info(
    `# Verify: GET /store/products?region_id=${region.id}&fields=*variants.calculated_price with publishable key`
  )
}

export default seedGhanaData
