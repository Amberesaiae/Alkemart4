/**
 * Bootstrap Alkemart commerce infrastructure (NO catalog).
 *
 * Creates / reuses ONLY:
 *   - Region "Ghana" (currency ghs, country gh)
 *   - Sales channel "Alkemart Storefront" (does not create an extra Default)
 *   - Stock location "Alkemart Accra Warehouse" linked to the sales channel
 *   - Default shipping profile
 *   - Ghana fulfillment set + standard shipping option
 *   - Publishable API key linked to exactly one sales channel
 *
 * Does NOT create products, categories, vendors, or inventory stock rows.
 * Production catalog comes from ETL (migrate-from-express), not seed.
 *
 * Idempotent. Safe to re-run.
 *
 * Usage:
 *   npx medusa exec ./src/scripts/bootstrap-commerce-context.ts
 */

import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  createApiKeysWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows"

const REGION_NAME = "Ghana"
const REGION_CURRENCY = "ghs"
const REGION_COUNTRY = "gh"

const SALES_CHANNEL_NAME = "Alkemart Storefront"
const SALES_CHANNEL_DESCRIPTION = "Alkemart customer-facing storefront channel"

const STOCK_LOCATION_NAME = "Alkemart Accra Warehouse"
const SHIPPING_PROFILE_NAME = "Default Shipping Profile"
const FULFILLMENT_SET_NAME = "Alkemart Ghana delivery"
const SHIPPING_OPTION_NAME = "Standard Ghana Delivery"

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

async function bootstrapCommerceContext({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const regionModule = container.resolve(Modules.REGION)
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL)
  const stockLocationModule = container.resolve(Modules.STOCK_LOCATION)
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT)
  const apiKeyModule = container.resolve(Modules.API_KEY)

  logger.info(
    "=== Alkemart bootstrap-commerce-context (infrastructure only, NO catalog) ==="
  )

  // -------------------------------------------------------------------------
  // 1. Region: Ghana / ghs / gh
  // -------------------------------------------------------------------------
  let region = (
    await regionModule.listRegions({ name: REGION_NAME }, { take: 1 })
  )[0]

  if (!region) {
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
  // 2. Sales channel: only "Alkemart Storefront" (do not create Default)
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
    logger.info(
      `Sales-channel↔stock-location link: ${err?.message?.slice(0, 120) ?? err}`
    )
  }

  // -------------------------------------------------------------------------
  // 4. Shipping profile
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
      try {
        const created = await fulfillmentModule.createShippingProfiles({
          name: SHIPPING_PROFILE_NAME,
          type: "default",
        })
        shippingProfileId = Array.isArray(created)
          ? created[0]?.id
          : created?.id
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
  // 5. Fulfillment set (Ghana) + standard shipping option
  // -------------------------------------------------------------------------
  let fulfillmentSetId: string | undefined
  let serviceZoneId: string | undefined

  try {
    const { data: existingSets } = await query.graph({
      entity: "fulfillment_set",
      fields: ["id", "name", "service_zones.id", "service_zones.name"],
    })
    const sets = asArray<{
      id: string
      name?: string
      service_zones?: Array<{ id?: string; name?: string }>
    }>(existingSets)
    const ghanaSet =
      sets.find((s) => /ghana|accra|alkemart/i.test(s.name || "")) || sets[0]

    if (ghanaSet) {
      fulfillmentSetId = ghanaSet.id
      serviceZoneId = ghanaSet.service_zones?.[0]?.id
      logger.info(`Fulfillment set reused: ${fulfillmentSetId}`)
    }
  } catch (err: any) {
    logger.warn(`Fulfillment set query failed: ${err?.message ?? err}`)
  }

  if (!fulfillmentSetId) {
    const created = await fulfillmentModule.createFulfillmentSets({
      name: FULFILLMENT_SET_NAME,
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
    logger.info(`Fulfillment set created: ${fulfillmentSetId}`)

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
      logger.warn(
        `Link stock location ↔ fulfillment set: ${err?.message ?? err}`
      )
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
      logger.warn(
        `Link stock location ↔ provider: ${err?.message ?? err}`
      )
    }
  }

  if (!serviceZoneId && fulfillmentSetId) {
    try {
      const { data: reloaded } = await query.graph({
        entity: "fulfillment_set",
        fields: ["id", "service_zones.id"],
        filters: { id: fulfillmentSetId },
      })
      serviceZoneId = asArray<{
        service_zones?: Array<{ id?: string }>
      }>(reloaded)?.[0]?.service_zones?.[0]?.id
    } catch {
      // ignore
    }
  }

  if (shippingProfileId && serviceZoneId) {
    let alreadyOption: { id: string; name?: string } | undefined
    try {
      const { data: existingOptions } = await query.graph({
        entity: "shipping_option",
        fields: ["id", "name"],
      })
      alreadyOption = asArray<{ id: string; name?: string }>(
        existingOptions
      ).find((o) => /standard|ghana|delivery/i.test(o.name || ""))
    } catch {
      alreadyOption = undefined
    }

    if (alreadyOption) {
      logger.info(
        `Shipping option reused: ${alreadyOption.id} ${alreadyOption.name}`
      )
    } else {
      try {
        const { result } = await createShippingOptionsWorkflow(container).run({
          input: [
            {
              name: SHIPPING_OPTION_NAME,
              price_type: "flat",
              provider_id: "manual_manual",
              service_zone_id: serviceZoneId,
              shipping_profile_id: shippingProfileId,
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
          `Shipping option created: ${JSON.stringify(result?.[0]?.id || result)}`
        )
      } catch (err: any) {
        logger.warn(
          `Shipping option create: ${err?.message?.slice(0, 200) ?? err}`
        )
      }
    }
  } else {
    logger.warn(
      `Skipping shipping option (shippingProfileId=${shippingProfileId} serviceZoneId=${serviceZoneId})`
    )
  }

  // -------------------------------------------------------------------------
  // 6. Publishable key linked to exactly one sales channel
  // -------------------------------------------------------------------------
  let keys = await apiKeyModule.listApiKeys({ type: "publishable" })
  let key = Array.isArray(keys) ? keys[0] : undefined

  if (!key) {
    logger.info("No publishable API key found — creating one…")
    const { result } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [
          {
            title: SALES_CHANNEL_NAME,
            type: "publishable",
            created_by: "",
          },
        ],
      },
    })
    key = result[0]
    if (!key) {
      throw new Error("Failed to create publishable API key")
    }
    logger.info(`Created publishable API key id=${key.id}`)
  } else {
    logger.info(`Using existing publishable API key id=${key.id}`)
  }

  let currentlyLinkedIds: string[] = []
  try {
    const { data } = await query.graph({
      entity: "api_key",
      fields: ["id", "sales_channels.id", "sales_channels.name"],
      filters: { id: key.id },
    })
    const row = Array.isArray(data) ? data[0] : data
    const linked = (row as { sales_channels?: { id: string; name?: string }[] })
      ?.sales_channels
    if (Array.isArray(linked)) {
      currentlyLinkedIds = linked.map((sc) => sc.id).filter(Boolean)
      logger.info(
        `Currently linked sales channels (${currentlyLinkedIds.length}): ` +
          linked.map((sc) => `${sc.name ?? "?"} (${sc.id})`).join(", ")
      )
    }
  } catch (err) {
    logger.warn(
      `Could not query existing key↔channel links (will still add preferred): ${err}`
    )
  }

  const toRemove = currentlyLinkedIds.filter((id) => id !== salesChannel.id)
  const needsAdd = !currentlyLinkedIds.includes(salesChannel.id)

  if (!toRemove.length && !needsAdd) {
    logger.info(
      "Publishable key already linked to exactly the preferred sales channel — no change"
    )
  } else {
    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: {
        id: key.id,
        add: needsAdd ? [salesChannel.id] : [],
        remove: toRemove,
      },
    })
    if (toRemove.length) {
      logger.info(`Removed ${toRemove.length} extra sales channel link(s)`)
    }
    if (needsAdd) {
      logger.info(`Linked key to sales channel ${salesChannel.id}`)
    }
  }

  const tokenPrefix =
    typeof key.token === "string" && key.token.length > 0
      ? key.token.startsWith("pk_")
        ? key.token.slice(0, Math.min(12, key.token.length))
        : `pk_${key.token.slice(0, 8)}`
      : "pk_(no-token)"

  // -------------------------------------------------------------------------
  // 7. Machine-readable summary (no products)
  // -------------------------------------------------------------------------
  logger.info("=== Bootstrap complete (no catalog) ===")
  logger.info(`ALKEMART_REGION_ID=${region.id}`)
  logger.info(`ALKEMART_SALES_CHANNEL_ID=${salesChannel.id}`)
  logger.info(`ALKEMART_STOCK_LOCATION_ID=${stockLocation.id}`)
  logger.info(`ALKEMART_PUBLISHABLE_KEY_PREFIX=${tokenPrefix}`)
  if (typeof key.token === "string" && key.token.length > 0) {
    // Publishable tokens are intended for SPA env; full token for ops.
    logger.info(`ALKEMART_PUBLISHABLE_KEY=${key.token}`)
  }
  if (shippingProfileId) {
    logger.info(`ALKEMART_SHIPPING_PROFILE_ID=${shippingProfileId}`)
  }
  logger.info(
    "# Copy ALKEMART_* into backend .env and VITE_MEDUSA_* into SPA .env"
  )
  logger.info(
    "# Catalog: use ETL migrate-from-express — do NOT run seed-ghana in production"
  )
}

export default bootstrapCommerceContext
