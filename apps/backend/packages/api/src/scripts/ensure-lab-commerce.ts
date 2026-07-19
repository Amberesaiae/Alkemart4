/**
 * Idempotent lab seller commerce spine:
 *   - seller@alkemart.local approved + member auth
 *   - stock location + fulfillment set + Ghana service zone
 *   - shipping profile + Standard delivery option (GHS)
 *   - one published product + offer (if none exist)
 *
 * Onboarding (ADR 2026-07-18): real wizard is create → pending_approval →
 * admin approve → location/shipping → active. This script approves first then
 * completes setup so lab readiness phase becomes `active`. Soft gates block
 * proposed products / offers until setup is complete when
 * ALKEMART_STRICT_PROPOSE_GATES is on (default).
 *
 * Run (from packages/api):
 *   bunx medusa exec ./src/scripts/ensure-lab-commerce.ts
 *
 * Seller Hub login: POST /auth/member/emailpass (not /auth/seller).
 */
import type { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import { ProductStatus } from "@mercurjs/types"
import {
  approveSellerWorkflow,
  createOffersWorkflow,
  createProductsWorkflow,
  createSellerAccountWorkflow,
  createSellerShippingOptionsWorkflow,
  createSellerShippingProfilesWorkflow,
  createSellerStockLocationsWorkflow,
} from "@mercurjs/core/workflows"
import {
  createLocationFulfillmentSetWorkflow,
  createServiceZonesWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"

const SELLER_EMAIL = "seller@alkemart.local"
const SELLER_PASSWORD = "supersecret"
const PRODUCT_HANDLE = "lab-ghana-rice-5kg"

export default async function ensureLabCommerce({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const authModuleService = container.resolve(Modules.AUTH)
  const storeModuleService = container.resolve(Modules.STORE)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)

  // ─── Seller + auth ───────────────────────────────────────────────
  let sellerId: string
  {
    const { data: existing } = await query.graph({
      entity: "seller",
      fields: ["id", "name", "email", "status"],
      filters: { email: SELLER_EMAIL },
    })

    if (existing[0]) {
      sellerId = existing[0].id
      logger.info(
        `Lab seller exists: ${sellerId} (${existing[0].status})`,
      )
      if (existing[0].status !== "open") {
        await approveSellerWorkflow(container).run({
          input: { seller_id: sellerId },
        })
        logger.info("Approved lab seller.")
      }
    } else {
      logger.info(`Creating lab seller ${SELLER_EMAIL}...`)
      let authIdentityId: string
      const registerResponse = await authModuleService.register("emailpass", {
        body: { email: SELLER_EMAIL, password: SELLER_PASSWORD },
      })
      if (registerResponse.success && registerResponse.authIdentity) {
        authIdentityId = registerResponse.authIdentity.id
      } else {
        const [providerIdentity] =
          await authModuleService.listProviderIdentities({
            entity_id: SELLER_EMAIL,
            provider: "emailpass",
          })
        if (!providerIdentity?.auth_identity_id) {
          throw new Error(
            `Could not register or find auth identity for ${SELLER_EMAIL}`,
          )
        }
        authIdentityId = providerIdentity.auth_identity_id
      }

      const { result: seller } = await createSellerAccountWorkflow(
        container,
      ).run({
        input: {
          auth_identity_id: authIdentityId,
          member_email: SELLER_EMAIL,
          first_name: "Lab",
          last_name: "Seller",
          seller: {
            name: "Alkemart Lab Shop",
            email: SELLER_EMAIL,
            currency_code: "ghs",
            description:
              "Lab marketplace seller for Ghana COD / MoMo testing.",
          },
        },
      })
      sellerId = seller.id
      await approveSellerWorkflow(container).run({
        input: { seller_id: sellerId },
      })
      logger.info(`Created + approved lab seller ${sellerId}`)
    }
  }

  const { data: members } = await query.graph({
    entity: "member",
    fields: ["id", "email"],
    filters: { email: SELLER_EMAIL },
  })
  const memberId = members[0]?.id
  if (!memberId) {
    throw new Error(
      `No member for ${SELLER_EMAIL} — Seller Hub auth will fail. Re-create seller account.`,
    )
  }
  logger.info(`Member ready: ${memberId} (login via /auth/member/emailpass)`)

  // ─── Region / sales channel ──────────────────────────────────────
  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "currency_code", "countries.iso_2"],
  })
  const ghana =
    regions.find(
      (r: { currency_code?: string; countries?: { iso_2?: string }[] }) =>
        (r.currency_code || "").toLowerCase() === "ghs" ||
        (r.countries || []).some(
          (c) => (c.iso_2 || "").toLowerCase() === "gh",
        ),
    ) || regions[0]
  if (!ghana?.id) throw new Error("No region found — run ensure-ghana-region first")
  const regionId = ghana.id as string

  const [store] = await storeModuleService.listStores()
  let salesChannels = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  })
  if (!salesChannels.length) {
    salesChannels = await salesChannelModuleService.listSalesChannels({})
  }
  const salesChannelId = salesChannels[0]?.id
  if (!salesChannelId) throw new Error("No sales channel found")

  // ─── Stock location + fulfillment ────────────────────────────────
  const { data: sellerLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name", "fulfillment_sets.id"],
    filters: {},
  })

  // Mercur links locations to sellers — list vendor ones via seller link if present
  let stockLocationId: string | null = null
  let fulfillmentSetId: string | null = null

  // Prefer locations already created for this seller via createSellerStockLocations
  // Graph may not filter by seller; try seller_stock_location link entity if available.
  try {
    const linked = await query.graph({
      entity: "seller",
      fields: ["id", "stock_locations.id", "stock_locations.name", "stock_locations.fulfillment_sets.id"],
      filters: { id: sellerId },
    })
    const locs =
      (linked.data?.[0] as {
        stock_locations?: {
          id: string
          name?: string
          fulfillment_sets?: { id: string }[]
        }[]
      })?.stock_locations || []
    if (locs[0]?.id) {
      stockLocationId = locs[0].id
      fulfillmentSetId = locs[0].fulfillment_sets?.[0]?.id ?? null
      logger.info(`Existing seller stock location: ${stockLocationId}`)
    }
  } catch {
    /* entity shape varies */
  }

  if (!stockLocationId) {
    logger.info("Creating Accra warehouse stock location for lab seller...")
    const { result: locs } = await createSellerStockLocationsWorkflow(
      container,
    ).run({
      input: {
        seller_id: sellerId,
        locations: [
          {
            name: "Lab Accra warehouse",
            address: {
              city: "Accra",
              country_code: "GH",
              province: "Greater Accra",
              address_1: "Spintex Road, Alkemart Lab Depot",
              postal_code: "GA-184-1234",
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
    } catch (e) {
      logger.info(
        `Fulfillment provider link may already exist: ${e instanceof Error ? e.message : e}`,
      )
    }

    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: {
        id: stockLocationId,
        add: [salesChannelId],
      },
    })

    if (store?.id) {
      try {
        await updateStoresWorkflow(container).run({
          input: {
            selector: { id: store.id },
            update: { default_location_id: stockLocationId },
          },
        })
      } catch {
        /* non-fatal */
      }
    }

    await createLocationFulfillmentSetWorkflow(container).run({
      input: {
        location_id: stockLocationId,
        fulfillment_set_data: {
          name: "Lab Accra delivery",
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
    fulfillmentSetId = locationWithSet?.fulfillment_sets?.[0]?.id ?? null
    logger.info(
      `Stock location ${stockLocationId} + fulfillment set ${fulfillmentSetId}`,
    )
  }

  if (!fulfillmentSetId && stockLocationId) {
    const {
      data: [locationWithSet],
    } = await query.graph({
      entity: "stock_location",
      fields: ["id", "fulfillment_sets.id"],
      filters: { id: stockLocationId },
    })
    fulfillmentSetId = locationWithSet?.fulfillment_sets?.[0]?.id ?? null
    if (!fulfillmentSetId) {
      await createLocationFulfillmentSetWorkflow(container).run({
        input: {
          location_id: stockLocationId,
          fulfillment_set_data: {
            name: "Lab Accra delivery",
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
        again.data?.[0]?.fulfillment_sets?.[0]?.id ?? null
    }
  }

  if (!fulfillmentSetId) {
    throw new Error("Could not resolve fulfillment set for lab seller")
  }

  // Service zone Ghana
  let serviceZoneId: string | null = null
  try {
    const { data: fsets } = await query.graph({
      entity: "fulfillment_set",
      fields: ["id", "service_zones.id", "service_zones.name"],
      filters: { id: fulfillmentSetId },
    })
    const zones =
      (fsets?.[0] as { service_zones?: { id: string; name?: string }[] })
        ?.service_zones || []
    serviceZoneId = zones[0]?.id ?? null
  } catch {
    /* continue */
  }

  if (!serviceZoneId) {
    const { result: zones } = await createServiceZonesWorkflow(container).run({
      input: {
        data: [
          {
            fulfillment_set_id: fulfillmentSetId,
            name: "Ghana",
            geo_zones: [
              { country_code: "gh", type: "country" as const },
            ],
          },
        ],
      },
    })
    serviceZoneId = zones[0].id
    logger.info(`Created service zone ${serviceZoneId}`)
  }

  // ─── Shipping profile + options ──────────────────────────────────
  let shippingProfileId: string | null = null
  try {
    const { data: sellerWithProfiles } = await query.graph({
      entity: "seller",
      fields: ["id", "shipping_profiles.id", "shipping_profiles.name"],
      filters: { id: sellerId },
    })
    const profiles =
      (sellerWithProfiles?.[0] as {
        shipping_profiles?: { id: string; name?: string }[]
      })?.shipping_profiles || []
    shippingProfileId = profiles[0]?.id ?? null
  } catch {
    /* continue */
  }

  if (!shippingProfileId) {
    const { result: profiles } =
      await createSellerShippingProfilesWorkflow(container).run({
        input: {
          seller_id: sellerId,
          shipping_profiles: [
            { name: "Lab Ghana courier", type: "default" },
          ],
        },
      })
    shippingProfileId = profiles[0].id
    logger.info(`Created shipping profile ${shippingProfileId}`)
  }

  // Shipping options — create if seller has none
  let hasShippingOption = false
  try {
    const { data: sellerOpts } = await query.graph({
      entity: "seller",
      fields: ["id", "shipping_options.id"],
      filters: { id: sellerId },
    })
    const opts =
      (sellerOpts?.[0] as { shipping_options?: { id: string }[] })
        ?.shipping_options || []
    hasShippingOption = opts.length > 0
  } catch {
    hasShippingOption = false
  }

  if (!hasShippingOption) {
    await createSellerShippingOptionsWorkflow(container).run({
      input: {
        seller_id: sellerId,
        shipping_options: [
          {
            name: "Greater Accra courier (lab)",
            price_type: "flat",
            provider_id: "manual_manual",
            service_zone_id: serviceZoneId!,
            shipping_profile_id: shippingProfileId!,
            type: {
              label: "Same / next day Accra",
              description: "Lab courier within Greater Accra, 1–2 days.",
              code: "lab_accra_courier",
            },
            prices: [
              { currency_code: "ghs", amount: 20 },
              { region_id: regionId, amount: 20 },
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
          {
            name: "Nationwide Ghana (lab)",
            price_type: "flat",
            provider_id: "manual_manual",
            service_zone_id: serviceZoneId!,
            shipping_profile_id: shippingProfileId!,
            type: {
              label: "Nationwide",
              description: "Bus parcel / courier, 2–5 days.",
              code: "lab_nationwide_gh",
            },
            prices: [
              { currency_code: "ghs", amount: 40 },
              { region_id: regionId, amount: 40 },
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
    logger.info("Created lab shipping options.")
  } else {
    logger.info("Lab seller already has shipping options.")
  }

  // ─── Product + offer ─────────────────────────────────────────────
  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "status", "variants.id"],
    filters: { handle: PRODUCT_HANDLE },
  })

  let productId = existingProducts[0]?.id as string | undefined
  let variantId = existingProducts[0]?.variants?.[0]?.id as string | undefined

  if (!productId) {
    logger.info(`Creating lab product ${PRODUCT_HANDLE}...`)
    const { result: products } = await createProductsWorkflow(container).run({
      input: {
        created_by: memberId,
        products: [
          {
            title: "Local Rice 5kg (Lab)",
            description:
              "Ghana-milled rice bag for COD lab checkout. Sold by Alkemart Lab Shop.",
            handle: PRODUCT_HANDLE,
            weight: 5000,
            status: ProductStatus.PUBLISHED,
            seller_ids: [sellerId],
            attributes: [
              {
                title: "Size",
                values: ["5kg"],
                is_variant_axis: true,
              },
            ],
            variants: [
              {
                title: "5kg",
                sku: "LAB-RICE-5KG",
                options: { Size: "5kg" },
              },
            ],
          },
        ],
      },
    })
    productId = products[0]?.id
    const reloaded = await query.graph({
      entity: "product",
      fields: ["id", "variants.id"],
      filters: { id: productId },
    })
    variantId = reloaded.data?.[0]?.variants?.[0]?.id
    logger.info(`Product ${productId} variant ${variantId}`)
  } else {
    logger.info(`Lab product exists: ${productId}`)
  }

  if (!variantId) {
    throw new Error("Lab product has no variant")
  }

  // Offer for this variant?
  const { data: offers } = await query.graph({
    entity: "offer",
    fields: ["id", "variant_id", "seller_id", "product_id"],
    filters: { seller_id: sellerId, variant_id: variantId },
  })

  if (!offers?.length) {
    if (!stockLocationId || !shippingProfileId) {
      throw new Error("Missing stock location or shipping profile for offer")
    }
    await createOffersWorkflow(container).run({
      input: {
        offers: [
          {
            seller_id: sellerId,
            created_by: memberId,
            sku: "OFFER-LAB-RICE-5KG",
            variant_id: variantId,
            shipping_profile_id: shippingProfileId,
            inventory_items: [
              {
                sku: "OFFER-LAB-RICE-5KG-INV",
                stock_levels: [
                  {
                    location_id: stockLocationId,
                    stocked_quantity: 1000,
                  },
                ],
              },
            ],
            prices: [{ amount: 95, currency_code: "ghs" }],
          },
        ],
      },
    })
    logger.info("Created lab offer for rice product.")
  } else {
    logger.info(`Lab offer exists: ${offers[0].id}`)
  }

  // Best-effort Ghana categories (idempotent). Safe if seed module API differs.
  try {
    const mod = await import("./ensure-ghana-categories")
    const ensureCats = (mod as { default?: (args: ExecArgs) => Promise<void> })
      .default
    if (ensureCats) {
      await ensureCats({ container } as ExecArgs)
    }
  } catch (e) {
    logger.warn(
      `Category seed skipped: ${e instanceof Error ? e.message : String(e)}`,
    )
  }

  logger.info(
    [
      "Lab commerce ready.",
      `  seller:  ${sellerId}`,
      `  member:  ${memberId}`,
      `  product: ${productId}`,
      `  login:   ${SELLER_EMAIL} / ${SELLER_PASSWORD}`,
      "  auth:    POST /auth/member/emailpass",
      "  header:  x-seller-id: <seller id>",
      "  onboarding: GET /vendor/alkemart/onboarding/status",
      "  catalog:    GET /store/alkemart/catalog",
    ].join("\n"),
  )
}
