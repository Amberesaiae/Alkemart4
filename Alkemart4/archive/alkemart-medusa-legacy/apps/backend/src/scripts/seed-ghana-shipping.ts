/**
 * DEV / CI FIXTURE ONLY — Idempotent Ghana shipping option seed (COD smoke).
 *
 * Prefer `bootstrap-commerce-context.ts` for production infrastructure.
 * Refused when `NODE_ENV=production`.
 *
 * Usage (development / CI only):
 *   npx medusa exec ./src/scripts/seed-ghana-shipping.ts
 */
import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import { createShippingOptionsWorkflow } from "@medusajs/medusa/core-flows"

export default async function seedGhanaShipping({ container }: ExecArgs) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "seed-ghana-shipping is a DEV FIXTURE only — refused in production. Use bootstrap-commerce-context or ETL migrate-from-express for real data."
    )
  }

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT)
  const stockLocationModule = container.resolve(Modules.STOCK_LOCATION)
  const regionModule = container.resolve(Modules.REGION)

  const regions = await regionModule.listRegions({})
  const regionList = Array.isArray(regions) ? regions : []
  const region =
    regionList.find((r: { currency_code?: string; name?: string }) =>
      (r.currency_code || "").toLowerCase() === "ghs"
    ) ||
    regionList.find((r: { name?: string }) => /ghana/i.test(r.name || "")) ||
    regionList[0]

  if (!region) {
    throw new Error("No region found — run seed-ghana first")
  }

  const locations = await stockLocationModule.listStockLocations({}, { take: 5 })
  const stockLocation = (Array.isArray(locations) ? locations : [])[0]
  if (!stockLocation) {
    throw new Error("No stock location found — run seed-ghana first")
  }

  const { data: profiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id", "name", "type"],
  })
  const shippingProfile = (profiles as { id: string }[])?.[0]
  if (!shippingProfile) {
    throw new Error("No shipping profile found")
  }

  // Ensure fulfillment set + GH service zone
  let fulfillmentSetId: string | undefined
  let serviceZoneId: string | undefined

  const { data: existingSets } = await query.graph({
    entity: "fulfillment_set",
    fields: ["id", "name", "service_zones.id", "service_zones.name"],
  })
  const sets = (existingSets as any[]) || []
  const ghanaSet =
    sets.find((s) => /ghana|accra|alkemart/i.test(s.name || "")) || sets[0]

  if (ghanaSet) {
    fulfillmentSetId = ghanaSet.id
    serviceZoneId = ghanaSet.service_zones?.[0]?.id
    logger.info(`Reusing fulfillment set ${fulfillmentSetId}`)
  } else {
    const created = await fulfillmentModule.createFulfillmentSets({
      name: "Alkemart Ghana delivery",
      type: "shipping",
      service_zones: [
        {
          name: "Ghana",
          geo_zones: [{ type: "country", country_code: "gh" }],
        },
      ],
    })
    const set = Array.isArray(created) ? created[0] : created
    fulfillmentSetId = set.id
    serviceZoneId = set.service_zones?.[0]?.id
    logger.info(`Created fulfillment set ${fulfillmentSetId}`)

    try {
      await link.create({
        [Modules.STOCK_LOCATION]: {
          stock_location_id: stockLocation.id,
        },
        [Modules.FULFILLMENT]: {
          fulfillment_set_id: fulfillmentSetId,
        },
      })
    } catch (err: any) {
      logger.warn(`Link stock location ↔ fulfillment set: ${err?.message ?? err}`)
    }

    try {
      await link.create({
        [Modules.STOCK_LOCATION]: {
          stock_location_id: stockLocation.id,
        },
        [Modules.FULFILLMENT]: {
          fulfillment_provider_id: "manual_manual",
        },
      })
    } catch (err: any) {
      logger.warn(`Link stock location ↔ provider: ${err?.message ?? err}`)
    }
  }

  if (!serviceZoneId) {
    // Reload
    const { data: reloaded } = await query.graph({
      entity: "fulfillment_set",
      fields: ["id", "service_zones.id"],
      filters: { id: fulfillmentSetId },
    })
    serviceZoneId = (reloaded as any)?.[0]?.service_zones?.[0]?.id
  }

  if (!serviceZoneId) {
    throw new Error("Could not resolve service_zone_id")
  }

  const { data: existingOptions } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name"],
  })
  const already = ((existingOptions as any[]) || []).find((o) =>
    /standard|ghana|delivery/i.test(o.name || "")
  )
  if (already) {
    logger.info(`Shipping option already exists: ${already.id} ${already.name}`)
    return
  }

  const { result } = await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Standard Ghana Delivery",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: serviceZoneId,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Standard",
          description: "Delivery within Ghana in 2-4 days",
          code: "standard_gh",
        },
        prices: [
          { currency_code: "ghs", amount: 20 },
          { region_id: region.id, amount: 20 },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
    ],
  })

  logger.info(
    `Created shipping option: ${JSON.stringify(result?.[0]?.id || result)}`
  )
}
