/**
 * DEV / CI FIXTURE ONLY — marketplace vendor rows for local smoke tests.
 *
 * Production vendors come from ETL (migrate-from-express), not this seed.
 * Refused when `NODE_ENV=production`.
 *
 * Usage (development / CI only):
 *   npx medusa exec ./src/scripts/seed-vendors.ts
 */
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

async function seedVendors({ container }: ExecArgs) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "seed-vendors is a DEV FIXTURE only — refused in production. Use ETL migrate-from-express for real data."
    )
  }

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  // Resolve the marketplace module service (custom module)
  let marketplaceService: any
  try {
    marketplaceService = container.resolve("marketplaceModuleService")
  } catch {
    logger.warn("marketplaceModuleService not found in container — skipping vendor seed")
    return
  }

  logger.info("Seeding vendor data...")

  const vendors = [
    {
      slug: "ama-tech-hub",
      name: "Ama Tech Hub",
      bio: "Trusted electronics and gadgets store in Accra. Authorized Samsung and Xiaomi dealer.",
      ratingAvgX100: 450,
      ratingCount: 128,
      badgeTopSeller: true,
      badgeFastShipper: true,
      commissionBps: 500,
      status: "active",
    },
    {
      slug: "kofi-fashion-house",
      name: "Kofi Fashion House",
      bio: "Premium African fashion — Ankara, Kente, and contemporary styles for men and women.",
      ratingAvgX100: 420,
      ratingCount: 87,
      badgeTopSeller: false,
      badgeFastShipper: true,
      commissionBps: 500,
      status: "active",
    },
    {
      slug: "accra-home-essentials",
      name: "Accra Home Essentials",
      bio: "Everything for your home — kitchen appliances, decor, and garden tools at great prices.",
      ratingAvgX100: 390,
      ratingCount: 54,
      badgeTopSeller: false,
      badgeFastShipper: false,
      commissionBps: 500,
      status: "active",
    },
    {
      slug: "ghana-groceries-direct",
      name: "Ghana Groceries Direct",
      bio: "Fresh groceries and household essentials delivered to your door. Accra and Kumasi.",
      ratingAvgX100: 410,
      ratingCount: 203,
      badgeTopSeller: true,
      badgeFastShipper: true,
      commissionBps: 300,
      status: "active",
    },
  ]

  for (const v of vendors) {
    try {
      const existing = await marketplaceService.listVendors({ slug: v.slug })
      if (existing && existing.length > 0) {
        logger.info(`Vendor "${v.name}" already exists (id: ${existing[0].id})`)
        continue
      }
      const vendor = await marketplaceService.createVendors(v)
      logger.info(`Created vendor "${v.name}" (id: ${vendor.id}, slug: ${v.slug})`)
    } catch (err: any) {
      logger.warn(`Vendor "${v.name}" creation failed: ${err.message?.substring(0, 120)}`)
    }
  }

  logger.info("Vendor seed complete!")
}

export default seedVendors
