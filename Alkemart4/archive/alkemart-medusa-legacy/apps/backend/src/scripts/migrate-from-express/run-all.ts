/**
 * Run Express → Medusa catalog ETL in order:
 *   01-categories → 02-vendors → 03-products
 *
 * Usage:
 *   npx medusa exec ./src/scripts/migrate-from-express/run-all.ts
 *
 * Or individually:
 *   npx medusa exec ./src/scripts/migrate-from-express/01-categories.ts
 *   npx medusa exec ./src/scripts/migrate-from-express/02-vendors.ts
 *   npx medusa exec ./src/scripts/migrate-from-express/03-products.ts
 *
 * Production: ALLOW_EXPRESS_MIGRATE=true
 * Source: EXPRESS_DATABASE_URL (fallback DATABASE_URL)
 */

import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { assertExpressMigrateAllowed } from "./guard"
import migrateCategories from "./01-categories"
import migrateVendors from "./02-vendors"
import migrateProducts from "./03-products"

async function runAll(args: ExecArgs) {
  assertExpressMigrateAllowed("run-all")

  const logger = args.container.resolve(ContainerRegistrationKeys.LOGGER)
  logger.info("=== migrate-from-express run-all (01 → 02 → 03) ===")

  await migrateCategories(args)
  await migrateVendors(args)
  await migrateProducts(args)

  logger.info("=== migrate-from-express run-all finished ===")
}

export default runAll
