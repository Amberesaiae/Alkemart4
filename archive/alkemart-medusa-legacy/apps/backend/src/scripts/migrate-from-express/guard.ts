/**
 * Production safety for Express → Medusa ETL scripts.
 *
 * In production, migration requires explicit opt-in via ALLOW_EXPRESS_MIGRATE=true.
 * Development / test always allow migrate.
 */

export function assertExpressMigrateAllowed(scriptName = "migrate-from-express"): void {
  const nodeEnv = process.env.NODE_ENV ?? "development"
  if (nodeEnv === "production" && process.env.ALLOW_EXPRESS_MIGRATE !== "true") {
    throw new Error(
      `${scriptName} refused: NODE_ENV=production requires ALLOW_EXPRESS_MIGRATE=true. ` +
        `This is a deliberate production safety guard.`
    )
  }
}

/** Shared commerce names from bootstrap-commerce-context / seed-ghana. */
export const SALES_CHANNEL_NAME = "Alkemart Storefront"
export const STOCK_LOCATION_NAME = "Alkemart Accra Warehouse"
export const REGION_CURRENCY = "ghs"
