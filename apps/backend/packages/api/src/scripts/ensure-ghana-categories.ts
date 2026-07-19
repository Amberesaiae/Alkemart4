/**
 * Seed Ghana marketplace top-level product categories (idempotent by handle).
 *
 * Run:
 *   bunx medusa exec ./src/scripts/ensure-ghana-categories.ts
 *
 * After seed, ops can assign categories on products. Vendor categories nav
 * remains optional; Admin can unhide Categories when managing taxonomy.
 */
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

const CATEGORIES: Array<{ name: string; handle: string; description: string }> = [
  {
    name: "Food & Groceries",
    handle: "food-groceries",
    description: "Cooking oil, staples, packaged food, drinks",
  },
  {
    name: "Fashion & Apparel",
    handle: "fashion-apparel",
    description: "Clothing, shoes, accessories",
  },
  {
    name: "Phones & Electronics",
    handle: "phones-electronics",
    description: "Mobiles, accessories, gadgets",
  },
  {
    name: "Home & Living",
    handle: "home-living",
    description: "Household, kitchen, furniture",
  },
  {
    name: "Health & Beauty",
    handle: "health-beauty",
    description: "Personal care, cosmetics, wellness",
  },
  {
    name: "Baby & Kids",
    handle: "baby-kids",
    description: "Baby care, toys, kids fashion",
  },
  {
    name: "Agriculture",
    handle: "agriculture",
    description: "Farm produce, inputs, tools",
  },
  {
    name: "Automotive",
    handle: "automotive",
    description: "Vehicle parts and accessories",
  },
  {
    name: "Services",
    handle: "services",
    description: "Local services listed as products when enabled",
  },
  {
    name: "Other",
    handle: "other",
    description: "Uncategorized marketplace goods",
  },
]

export default async function ensureGhanaCategories({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  let productModule: {
    createProductCategories?: (
      data: Array<Record<string, unknown>>,
    ) => Promise<unknown>
  }
  try {
    productModule = container.resolve(Modules.PRODUCT) as unknown as typeof productModule
  } catch {
    logger.error("Product module unavailable")
    return
  }

  const { data } = await query.graph({
    entity: "product_category",
    fields: ["id", "handle", "name"],
  })
  const existing = Array.isArray(data) ? data : data ? [data] : []
  const byHandle = new Map(
    existing.map((c) => [
      String((c as { handle?: string }).handle || ""),
      c as { id: string; handle: string },
    ]),
  )

  const toCreate = CATEGORIES.filter((c) => !byHandle.has(c.handle))
  if (!toCreate.length) {
    logger.info(
      `Ghana categories already present (${CATEGORIES.length} handles).`,
    )
    return
  }

  if (typeof productModule.createProductCategories !== "function") {
    // Medusa v2 shape may be createProductCategories on service
    const alt = productModule as {
      createProductCategories: (
        data: Array<Record<string, unknown>>,
      ) => Promise<unknown>
    }
    if (typeof alt.createProductCategories !== "function") {
      logger.error(
        "createProductCategories not found on product module — create categories via Admin UI",
      )
      return
    }
  }

  try {
    await productModule.createProductCategories!(
      toCreate.map((c) => ({
        name: c.name,
        handle: c.handle,
        description: c.description,
        is_active: true,
        is_internal: false,
      })),
    )
    logger.info(`Created ${toCreate.length} Ghana categories: ${toCreate.map((c) => c.handle).join(", ")}`)
  } catch (e) {
    logger.error(
      `Category seed failed: ${e instanceof Error ? e.message : String(e)}`,
    )
  }
}
