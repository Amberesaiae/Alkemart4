/**
 * ETL 01 — Express `categories` → Medusa product categories.
 *
 * Idempotency: Medusa handle = Express slug.
 *
 * Usage:
 *   npx medusa exec ./src/scripts/migrate-from-express/01-categories.ts
 *
 * Requires: EXPRESS_DATABASE_URL (or DATABASE_URL fallback).
 * Production: ALLOW_EXPRESS_MIGRATE=true
 */

import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createProductCategoriesWorkflow,
  updateProductCategoriesWorkflow,
} from "@medusajs/medusa/core-flows"
import { assertExpressMigrateAllowed } from "./guard"
import { queryExpress, redactedDbTarget } from "./db-source"

type ExpressCategory = {
  id: number
  slug: string
  name: string
  parent_id: number | null
  icon_key: string | null
  sort_order: number
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

async function migrateCategories({ container }: ExecArgs) {
  assertExpressMigrateAllowed("01-categories")

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const productModule = container.resolve(Modules.PRODUCT)

  logger.info("=== migrate-from-express 01-categories ===")
  logger.info(`Express source: ${redactedDbTarget()}`)

  let rows: ExpressCategory[]
  try {
    rows = await queryExpress<ExpressCategory>(
      `SELECT id, slug, name, parent_id, icon_key, sort_order
       FROM categories
       ORDER BY
         CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END,
         sort_order ASC,
         id ASC`
    )
  } catch (err: any) {
    const msg = err?.message ?? String(err)
    if (/relation ["']?categories["']? does not exist/i.test(msg)) {
      logger.info(
        "Express table `categories` does not exist — nothing to migrate (exit 0)"
      )
      return
    }
    throw err
  }

  logger.info(`Read ${rows.length} Express categories`)

  if (rows.length === 0) {
    logger.info("no source categories — nothing to migrate")
    return
  }

  // handle → medusa category id
  const handleToId = new Map<string, string>()
  // express id → medusa id (for parent wiring)
  const expressIdToMedusaId = new Map<number, string>()

  try {
    const existing = await productModule.listProductCategories({}, { take: 1000 })
    for (const cat of existing) {
      if (cat.handle) handleToId.set(cat.handle, cat.id)
    }
    logger.info(`Loaded ${existing.length} existing Medusa categories`)
  } catch (err: any) {
    logger.warn(`Bulk category list failed: ${err?.message ?? err}`)
  }

  let created = 0
  let updated = 0
  let skipped = 0
  let errors = 0

  // Multi-pass so parents resolve before children when possible
  const pending = [...rows]
  let guard = 0
  const maxPasses = pending.length + 2

  while (pending.length > 0 && guard < maxPasses) {
    guard++
    let progressed = false
    const still: ExpressCategory[] = []

    for (const row of pending) {
      const handle = (row.slug || "").trim()
      if (!handle) {
        logger.warn(`Skip category id=${row.id}: empty slug`)
        skipped++
        progressed = true
        continue
      }

      // Parent must exist in Medusa if Express has parent_id
      let parentCategoryId: string | undefined
      if (row.parent_id != null) {
        parentCategoryId = expressIdToMedusaId.get(row.parent_id)
        if (!parentCategoryId) {
          // Parent may already exist by handle from a prior migrate — look up later pass
          still.push(row)
          continue
        }
      }

      try {
        const existingId = handleToId.get(handle)
        if (existingId) {
          await updateProductCategoriesWorkflow(container).run({
            input: {
              selector: { id: existingId },
              update: {
                name: row.name,
                is_active: true,
                rank: row.sort_order ?? 0,
                ...(parentCategoryId
                  ? { parent_category_id: parentCategoryId }
                  : {}),
                metadata: {
                  express_category_id: row.id,
                  icon_key: row.icon_key,
                },
              },
            },
          })
          expressIdToMedusaId.set(row.id, existingId)
          updated++
          logger.info(
            `Updated category handle=${handle} id=${existingId} express_id=${row.id}`
          )
        } else {
          const { result } = await createProductCategoriesWorkflow(container).run({
            input: {
              product_categories: [
                {
                  name: row.name,
                  handle,
                  is_active: true,
                  rank: row.sort_order ?? 0,
                  ...(parentCategoryId
                    ? { parent_category_id: parentCategoryId }
                    : {}),
                  metadata: {
                    express_category_id: row.id,
                    icon_key: row.icon_key,
                  },
                },
              ],
            },
          })
          const cat = asArray<{ id: string; handle?: string }>(result)[0]
          if (!cat?.id) {
            // Race: re-list by handle
            const found = (
              await productModule.listProductCategories({ handle }, { take: 1 })
            )[0]
            if (found) {
              handleToId.set(handle, found.id)
              expressIdToMedusaId.set(row.id, found.id)
              updated++
              logger.info(
                `Reused category after create race handle=${handle} id=${found.id}`
              )
            } else {
              errors++
              logger.error(`Category create returned empty for handle=${handle}`)
            }
          } else {
            handleToId.set(handle, cat.id)
            expressIdToMedusaId.set(row.id, cat.id)
            created++
            logger.info(
              `Created category handle=${handle} id=${cat.id} express_id=${row.id}`
            )
          }
        }
        progressed = true
      } catch (err: any) {
        // Try recover by handle
        try {
          const found = (
            await productModule.listProductCategories({ handle }, { take: 1 })
          )[0]
          if (found) {
            handleToId.set(handle, found.id)
            expressIdToMedusaId.set(row.id, found.id)
            updated++
            progressed = true
            logger.info(
              `Category recovered by handle=${handle} id=${found.id}: ${err?.message?.slice(0, 80) ?? err}`
            )
            continue
          }
        } catch {
          // fall through
        }
        errors++
        logger.error(
          `Category handle=${handle} failed: ${err?.message?.slice(0, 200) ?? err}`
        )
        progressed = true // drop from pending to avoid infinite loop
      }
    }

    // Resolve parents that failed first pass because parent handle already in Medusa
    // but expressIdToMedusaId wasn't filled (parent not in this batch). Back-fill:
    for (const row of still.slice()) {
      if (row.parent_id == null) continue
      if (expressIdToMedusaId.has(row.parent_id)) continue
      const parentRow = rows.find((r) => r.id === row.parent_id)
      if (parentRow?.slug && handleToId.has(parentRow.slug)) {
        expressIdToMedusaId.set(row.parent_id, handleToId.get(parentRow.slug)!)
        progressed = true
      }
    }

    if (!progressed && still.length > 0) {
      // Force process remaining without parent link
      logger.warn(
        `${still.length} categories could not resolve parents — creating without parent_category_id`
      )
      for (const row of still) {
        const handle = (row.slug || "").trim()
        if (!handle) {
          skipped++
          continue
        }
        try {
          const existingId = handleToId.get(handle)
          if (existingId) {
            expressIdToMedusaId.set(row.id, existingId)
            updated++
          } else {
            const { result } = await createProductCategoriesWorkflow(container).run({
              input: {
                product_categories: [
                  {
                    name: row.name,
                    handle,
                    is_active: true,
                    rank: row.sort_order ?? 0,
                    metadata: {
                      express_category_id: row.id,
                      icon_key: row.icon_key,
                      express_parent_id: row.parent_id,
                    },
                  },
                ],
              },
            })
            const cat = asArray<{ id: string }>(result)[0]
            if (cat?.id) {
              handleToId.set(handle, cat.id)
              expressIdToMedusaId.set(row.id, cat.id)
              created++
            } else {
              errors++
            }
          }
        } catch (err: any) {
          errors++
          logger.error(
            `Orphan category handle=${handle}: ${err?.message?.slice(0, 160) ?? err}`
          )
        }
      }
      break
    }

    pending.length = 0
    pending.push(...still)
  }

  logger.info("=== 01-categories complete ===")
  logger.info(
    `counts: read=${rows.length} created=${created} updated=${updated} skipped=${skipped} errors=${errors}`
  )
}

export default migrateCategories
