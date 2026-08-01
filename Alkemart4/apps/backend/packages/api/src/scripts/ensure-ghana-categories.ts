/**
 * Seed Ghana marketplace top-level product categories (idempotent by handle).
 *
 * The seed is the canonical source of truth: it creates any missing categories
 * and reconciles rank / visibility / description on existing ones so the
 * taxonomy stays contiguous, active, and non-internal.
 *
 * Run:
 *   bunx medusa exec ./src/scripts/ensure-ghana-categories.ts
 *
 * Ranks reflect marketplace priority (Food & Beverages first, Utilities last).
 */
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

const CATEGORIES: Array<{
  name: string
  handle: string
  description: string
  rank: number
}> = [
  {
    name: "Food & Groceries",
    handle: "food-groceries",
    description: "Cooking oil, staples, packaged food, drinks",
    rank: 0,
  },
  {
    name: "Beverages",
    handle: "beverages",
    description: "Water, soft drinks, juices, sachets",
    rank: 1,
  },
  {
    name: "Fashion & Apparel",
    handle: "fashion-apparel",
    description: "Clothing, shoes, accessories",
    rank: 2,
  },
  {
    name: "Phones & Electronics",
    handle: "phones-electronics",
    description: "Mobiles, accessories, gadgets",
    rank: 3,
  },
  {
    name: "Home & Living",
    handle: "home-living",
    description: "Household, kitchen, furniture",
    rank: 4,
  },
  {
    name: "Health & Beauty",
    handle: "health-beauty",
    description: "Personal care, cosmetics, wellness",
    rank: 5,
  },
  {
    name: "Baby & Kids",
    handle: "baby-kids",
    description: "Baby care, toys, kids fashion",
    rank: 6,
  },
  {
    name: "Pet Care",
    handle: "pet-care",
    description: "Pet food, accessories, veterinary supplies",
    rank: 7,
  },
  {
    name: "Agriculture",
    handle: "agriculture",
    description: "Farm produce, inputs, tools",
    rank: 8,
  },
  {
    name: "Automotive",
    handle: "automotive",
    description: "Vehicle parts and accessories",
    rank: 9,
  },
  {
    name: "Services",
    handle: "services",
    description: "Local services listed as products when enabled",
    rank: 10,
  },
  {
    name: "Other",
    handle: "other",
    description: "Uncategorized marketplace goods",
    rank: 11,
  },
]

type ProductModule = {
  createProductCategories?: (
    data: Array<Record<string, unknown>>,
  ) => Promise<unknown>
  updateProductCategories?: (
    selector: Record<string, unknown>,
    data: Record<string, unknown>,
  ) => Promise<unknown>
}

export default async function ensureGhanaCategories({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  let productModule: ProductModule
  try {
    productModule = container.resolve(Modules.PRODUCT) as unknown as ProductModule
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

  let created = 0
  let updated = 0

  for (const cat of CATEGORIES) {
    const base = {
      name: cat.name,
      handle: cat.handle,
      description: cat.description,
      rank: cat.rank,
      is_active: true,
      is_internal: false,
    }
    const hit = byHandle.get(cat.handle)

    if (hit) {
      try {
        await productModule.updateProductCategories!({ handle: cat.handle }, base)
        updated++
      } catch (e) {
        logger.error(
          `Category update failed for ${cat.handle}: ${e instanceof Error ? e.message : String(e)}`,
        )
      }
    } else {
      try {
        await productModule.createProductCategories!([base])
        created++
      } catch (e) {
        logger.error(
          `Category create failed for ${cat.handle}: ${e instanceof Error ? e.message : String(e)}`,
        )
      }
    }
  }

  logger.info(
    `Category seed done — created: ${created}, reconciled: ${updated} (of ${CATEGORIES.length}).`,
  )
}
