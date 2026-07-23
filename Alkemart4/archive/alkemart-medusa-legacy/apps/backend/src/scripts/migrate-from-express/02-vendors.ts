/**
 * ETL 02 — Express `vendors` → marketplace Vendor module.
 *
 * Idempotency: Medusa vendor.slug = Express slug.
 *
 * Usage:
 *   npx medusa exec ./src/scripts/migrate-from-express/02-vendors.ts
 *
 * Requires: EXPRESS_DATABASE_URL (or DATABASE_URL fallback).
 * Production: ALLOW_EXPRESS_MIGRATE=true
 */

import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MARKETPLACE_MODULE } from "../../modules/marketplace"
import { assertExpressMigrateAllowed } from "./guard"
import { queryExpress, redactedDbTarget } from "./db-source"

type ExpressVendor = {
  id: number
  slug: string
  name: string
  rating_avg_x100: number
  rating_count: number
  badge_top_seller: boolean
  badge_fast_shipper: boolean
  bio: string | null
  paystack_recipient_code: string | null
  commission_bps: number
  status: string
}

async function resolveMarketplaceService(container: ExecArgs["container"]) {
  // Prefer module registration key; fall back to legacy seed name.
  for (const key of [MARKETPLACE_MODULE, "marketplaceModuleService"] as const) {
    try {
      return container.resolve(key) as {
        listVendors: (
          filters?: Record<string, unknown>,
          config?: Record<string, unknown>
        ) => Promise<any[]>
        createVendors: (data: Record<string, unknown> | Record<string, unknown>[]) => Promise<any>
        updateVendors: (data: Record<string, unknown> | Record<string, unknown>[]) => Promise<any>
      }
    } catch {
      // try next
    }
  }
  return null
}

function toVendorPayload(row: ExpressVendor) {
  return {
    slug: row.slug,
    name: row.name,
    bio: row.bio ?? null,
    rating_avg_x100: row.rating_avg_x100 ?? 0,
    rating_count: row.rating_count ?? 0,
    badge_top_seller: Boolean(row.badge_top_seller),
    badge_fast_shipper: Boolean(row.badge_fast_shipper),
    paystack_recipient_code: row.paystack_recipient_code ?? null,
    commission_bps: row.commission_bps ?? 700,
    status: row.status || "active",
  }
}

async function migrateVendors({ container }: ExecArgs) {
  assertExpressMigrateAllowed("02-vendors")

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  logger.info("=== migrate-from-express 02-vendors ===")
  logger.info(`Express source: ${redactedDbTarget()}`)

  const marketplace = await resolveMarketplaceService(container)
  if (!marketplace) {
    throw new Error(
      "marketplace module service not found (expected resolve key 'marketplace'). " +
        "Ensure medusa-config registers ./src/modules/marketplace."
    )
  }

  let rows: ExpressVendor[]
  try {
    rows = await queryExpress<ExpressVendor>(
      `SELECT
         id,
         slug,
         name,
         rating_avg_x100,
         rating_count,
         badge_top_seller,
         badge_fast_shipper,
         bio,
         paystack_recipient_code,
         commission_bps,
         status
       FROM vendors
       ORDER BY id ASC`
    )
  } catch (err: any) {
    const msg = err?.message ?? String(err)
    if (/relation ["']?vendors["']? does not exist/i.test(msg)) {
      logger.info(
        "Express table `vendors` does not exist — nothing to migrate (exit 0)"
      )
      return
    }
    throw err
  }

  logger.info(`Read ${rows.length} Express vendors`)

  if (rows.length === 0) {
    logger.info("no source vendors — nothing to migrate")
    return
  }

  let created = 0
  let updated = 0
  let skipped = 0
  let errors = 0

  for (const row of rows) {
    const slug = (row.slug || "").trim()
    if (!slug) {
      logger.warn(`Skip vendor id=${row.id}: empty slug`)
      skipped++
      continue
    }

    const payload = toVendorPayload({ ...row, slug })

    try {
      const existing = await marketplace.listVendors({ slug }, { take: 1 })
      const list = Array.isArray(existing) ? existing : []

      if (list.length > 0) {
        const id = list[0].id
        await marketplace.updateVendors({
          id,
          ...payload,
        })
        updated++
        logger.info(`Updated vendor slug=${slug} id=${id} express_id=${row.id}`)
      } else {
        const createdVendor = await marketplace.createVendors(payload)
        const vendor = Array.isArray(createdVendor)
          ? createdVendor[0]
          : createdVendor
        created++
        logger.info(
          `Created vendor slug=${slug} id=${vendor?.id ?? "?"} express_id=${row.id}`
        )
      }
    } catch (err: any) {
      errors++
      logger.error(
        `Vendor slug=${slug} failed: ${err?.message?.slice(0, 200) ?? err}`
      )
    }
  }

  logger.info("=== 02-vendors complete ===")
  logger.info(
    `counts: read=${rows.length} created=${created} updated=${updated} skipped=${skipped} errors=${errors}`
  )
}

export default migrateVendors
