/**
 * One-tap Ghana seller commerce spine.
 * Hides Mercur stock-location / shipping-profile / sales-channel jargon.
 * Seller answers: where they pack + delivery fee in GH₵.
 */
import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  createSellerShippingOptionsWorkflow,
  createSellerShippingProfilesWorkflow,
  createSellerStockLocationsWorkflow,
} from "@mercurjs/core/workflows"
import {
  createLocationFulfillmentSetWorkflow,
  createServiceZonesWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows"
import { GHANA } from "./ghana-locale"
import { evaluateSellerReadiness } from "./seller-readiness"

export type GhanaSetupInput = {
  seller_id: string
  /** Friendly name e.g. "Ama's shop — Madina" */
  pack_from_name?: string
  address_1: string
  city: string
  /** Ghana region e.g. Greater Accra */
  region?: string
  postal_code?: string
  phone?: string
  /** Flat delivery fee in major GHS units (default 20) */
  delivery_fee_ghs?: number
  delivery_label?: string
}

export type GhanaSetupResult = {
  ok: true
  stock_location_id: string
  shipping_profile_id: string
  service_zone_id: string | null
  shipping_option_created: boolean
  readiness: Awaited<ReturnType<typeof evaluateSellerReadiness>>
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v != null ? String(v).trim() : ""
}

export async function runGhanaSellerSetup(
  container: MedusaContainer,
  input: GhanaSetupInput,
): Promise<GhanaSetupResult> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }
  const link = container.resolve(ContainerRegistrationKeys.LINK) as {
    create: (data: unknown) => Promise<unknown>
  }
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL) as {
    listSalesChannels: (filters?: unknown) => Promise<{ id: string; name?: string }[]>
  }

  const sellerId = str(input.seller_id)
  if (!sellerId) throw new Error("seller_id required")

  const address1 = str(input.address_1)
  const city = str(input.city)
  if (!address1 || !city) {
    throw new Error("Tell us your area and city (e.g. Madina, Accra).")
  }

  const province = str(input.region) || GHANA.defaultRegion
  const packName =
    str(input.pack_from_name) || `Pack from ${city}`
  const fee =
    typeof input.delivery_fee_ghs === "number" && input.delivery_fee_ghs >= 0
      ? input.delivery_fee_ghs
      : 20
  const deliveryLabel =
    str(input.delivery_label) || "Delivery in Ghana (courier / bus parcel)"

  // Seller must be approved
  const { data: sellers } = await query.graph({
    entity: "seller",
    fields: ["id", "status", "name"],
    filters: { id: sellerId },
  })
  const seller = Array.isArray(sellers) ? sellers[0] : sellers
  const status = str((seller as { status?: string })?.status).toLowerCase()
  if (status !== "open") {
    throw new Error(
      status === "pending_approval"
        ? "Wait for shop approval first — then finish Ghana delivery setup."
        : "Shop must be approved (open) before setup.",
    )
  }

  // Region (Ghana / GHS)
  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "currency_code", "countries.iso_2"],
  })
  const regionList = Array.isArray(regions) ? regions : regions ? [regions] : []
  const ghanaRegion =
    regionList.find((r: { currency_code?: string; countries?: { iso_2?: string }[] }) => {
      const cur = str(r.currency_code).toLowerCase()
      const countries = r.countries || []
      return (
        cur === "ghs" ||
        countries.some((c) => str(c.iso_2).toLowerCase() === "gh")
      )
    }) || regionList[0]
  const regionId = str((ghanaRegion as { id?: string })?.id)
  if (!regionId) throw new Error("Ghana region missing — ops must seed GHS region.")

  let salesChannels = await salesChannelModule.listSalesChannels({
    name: "Default Sales Channel",
  })
  if (!salesChannels.length) {
    salesChannels = await salesChannelModule.listSalesChannels({})
  }
  const salesChannelId =
    process.env.DEFAULT_SALES_CHANNEL_ID?.trim() || salesChannels[0]?.id
  if (!salesChannelId) throw new Error("No sales channel configured.")

  // Existing location?
  let stockLocationId: string | null = null
  let fulfillmentSetId: string | null = null
  try {
    const { data: linked } = await query.graph({
      entity: "seller",
      fields: [
        "id",
        "stock_locations.id",
        "stock_locations.name",
        "stock_locations.fulfillment_sets.id",
      ],
      filters: { id: sellerId },
    })
    const row = Array.isArray(linked) ? linked[0] : linked
    const locs =
      (row as { stock_locations?: { id: string; fulfillment_sets?: { id: string }[] }[] })
        ?.stock_locations || []
    if (locs[0]?.id) {
      stockLocationId = locs[0].id
      fulfillmentSetId = locs[0].fulfillment_sets?.[0]?.id ?? null
    }
  } catch {
    /* continue */
  }

  if (!stockLocationId) {
    const { result: locs } = await createSellerStockLocationsWorkflow(
      container,
    ).run({
      input: {
        seller_id: sellerId,
        locations: [
          {
            name: packName,
            address: {
              address_1: address1,
              city,
              country_code: "GH",
              province,
              postal_code: str(input.postal_code) || undefined,
              phone: str(input.phone) || undefined,
            },
          },
        ],
      },
    })
    stockLocationId = locs[0].id

    try {
      await link.create({
        [Modules.STOCK_LOCATION]: { stock_location_id: stockLocationId },
        [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
      })
    } catch {
      /* may exist */
    }

    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: stockLocationId, add: [salesChannelId] },
    })

    await createLocationFulfillmentSetWorkflow(container).run({
      input: {
        location_id: stockLocationId,
        fulfillment_set_data: {
          name: `${packName} delivery`,
          type: "shipping",
        },
      },
    })

    const {
      data: [locationWithSet],
    } = await query.graph({
      entity: "stock_location",
      fields: ["id", "fulfillment_sets.id"],
      filters: { id: stockLocationId },
    })
    fulfillmentSetId =
      (locationWithSet as { fulfillment_sets?: { id: string }[] })
        ?.fulfillment_sets?.[0]?.id ?? null
  } else {
    // Ensure provider + SC link on existing location
    try {
      await link.create({
        [Modules.STOCK_LOCATION]: { stock_location_id: stockLocationId },
        [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
      })
    } catch {
      /* ok */
    }
    try {
      await linkSalesChannelsToStockLocationWorkflow(container).run({
        input: { id: stockLocationId, add: [salesChannelId] },
      })
    } catch {
      /* may already be linked */
    }
    if (!fulfillmentSetId) {
      await createLocationFulfillmentSetWorkflow(container).run({
        input: {
          location_id: stockLocationId,
          fulfillment_set_data: {
            name: `${packName} delivery`,
            type: "shipping",
          },
        },
      })
      const again = await query.graph({
        entity: "stock_location",
        fields: ["id", "fulfillment_sets.id"],
        filters: { id: stockLocationId },
      })
      fulfillmentSetId =
        (again.data?.[0] as { fulfillment_sets?: { id: string }[] })
          ?.fulfillment_sets?.[0]?.id ?? null
    }
  }

  if (!fulfillmentSetId) {
    throw new Error("Could not create delivery setup for this shop.")
  }

  // Ghana service zone
  let serviceZoneId: string | null = null
  try {
    const { data: fsets } = await query.graph({
      entity: "fulfillment_set",
      fields: ["id", "service_zones.id", "service_zones.name"],
      filters: { id: fulfillmentSetId },
    })
    const fs = Array.isArray(fsets) ? fsets[0] : fsets
    const zones =
      (fs as { service_zones?: { id: string }[] })?.service_zones || []
    serviceZoneId = zones[0]?.id ?? null
  } catch {
    /* create */
  }

  if (!serviceZoneId) {
    const { result: zones } = await createServiceZonesWorkflow(container).run({
      input: {
        data: [
          {
            fulfillment_set_id: fulfillmentSetId,
            name: "Ghana",
            geo_zones: [{ country_code: "gh", type: "country" as const }],
          },
        ],
      },
    })
    serviceZoneId = zones[0].id
  }

  // Shipping profile
  let shippingProfileId: string | null = null
  try {
    const { data: sellerWithProfiles } = await query.graph({
      entity: "seller",
      fields: ["id", "shipping_profiles.id", "shipping_profiles.name"],
      filters: { id: sellerId },
    })
    const row = Array.isArray(sellerWithProfiles)
      ? sellerWithProfiles[0]
      : sellerWithProfiles
    const profiles =
      (row as { shipping_profiles?: { id: string }[] })?.shipping_profiles ||
      []
    shippingProfileId = profiles[0]?.id ?? null
  } catch {
    /* create */
  }

  if (!shippingProfileId) {
    const { result: profiles } =
      await createSellerShippingProfilesWorkflow(container).run({
        input: {
          seller_id: sellerId,
          shipping_profiles: [
            { name: "Ghana delivery", type: "default" },
          ],
        },
      })
    shippingProfileId = profiles[0].id
  }

  // Shipping option if none
  let hasOption = false
  try {
    const { data: sellerOpts } = await query.graph({
      entity: "seller",
      fields: ["id", "shipping_options.id"],
      filters: { id: sellerId },
    })
    const row = Array.isArray(sellerOpts) ? sellerOpts[0] : sellerOpts
    const opts =
      (row as { shipping_options?: { id: string }[] })?.shipping_options || []
    hasOption = opts.length > 0
  } catch {
    hasOption = false
  }

  let shipping_option_created = false
  if (!hasOption && serviceZoneId && shippingProfileId) {
    await createSellerShippingOptionsWorkflow(container).run({
      input: {
        seller_id: sellerId,
        shipping_options: [
          {
            name: deliveryLabel,
            price_type: "flat",
            provider_id: "manual_manual",
            service_zone_id: serviceZoneId,
            shipping_profile_id: shippingProfileId,
            type: {
              label: "Ghana delivery",
              description: "Courier, rider, or bus parcel within Ghana.",
              code: "gh_seller_delivery",
            },
            prices: [
              { currency_code: "ghs", amount: fee },
              { region_id: regionId, amount: fee },
            ],
            rules: [
              {
                attribute: "enabled_in_store",
                value: "true",
                operator: "eq",
              },
              { attribute: "is_return", value: "false", operator: "eq" },
            ],
          },
        ],
      },
    })
    shipping_option_created = true
  }

  const readiness = await evaluateSellerReadiness(query, sellerId)

  return {
    ok: true,
    stock_location_id: stockLocationId!,
    shipping_profile_id: shippingProfileId!,
    service_zone_id: serviceZoneId,
    shipping_option_created,
    readiness,
  }
}
