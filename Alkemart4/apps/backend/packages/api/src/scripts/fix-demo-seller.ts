/**
 * One-shot fix: sets the dispatch address on the existing demo seller so it
 * passes the readiness checklist, then creates offers for all seeded products.
 *
 * Safe to run multiple times — skips if offers already exist.
 *
 * Usage:  bun medusa exec ./src/scripts/fix-demo-seller.ts
 */
import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { createOffersWorkflow } from "@mercurjs/core/workflows"

const SELLER_EMAIL = "seller@alkemart.local"

export default async function fixDemoSeller({ container }: ExecArgs) {
  const logger = container.resolve("logger") as { info: (m: string) => void; error: (m: string) => void }
  const query = container.resolve("query") as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  // ── 1. Locate demo seller ──────────────────────────────────────────────────
  const { data: sellers } = await query.graph({
    entity: "seller",
    fields: ["id", "name", "status", "address.id", "address.address_1", "address.city"],
    filters: { email: SELLER_EMAIL },
  }) as { data: Array<{ id: string; name: string; status: string; address?: { id?: string; address_1?: string; city?: string } }> }

  if (!sellers[0]) {
    logger.error("Demo seller not found — run the seed script first.")
    return
  }

  const demoSeller = sellers[0]
  logger.info(`Found demo seller: ${demoSeller.id} (${demoSeller.name})`)

  // ── 2. Update dispatch address ─────────────────────────────────────────────
  const sellerService = container.resolve("seller") as {
    updateSellers: (data: unknown) => Promise<unknown>
  }

  if (!demoSeller.address?.address_1 || !demoSeller.address?.city) {
    logger.info("Setting dispatch address on demo seller…")
    await sellerService.updateSellers({
      id: demoSeller.id,
      address: {
        address_1: "Spintex Road, near Coca-Cola depot",
        city: "Accra",
        country_code: "gh",
        province: "Greater Accra",
        postal_code: "GA-184-1234",
      },
    })
    logger.info("Address set ✔")
  } else {
    logger.info("Dispatch address already set, skipping.")
  }

  // ── 3. Locate demo seller member ───────────────────────────────────────────
  const { data: members } = await query.graph({
    entity: "member",
    fields: ["id"],
    filters: { email: SELLER_EMAIL },
  }) as { data: Array<{ id: string }> }

  if (!members[0]) {
    logger.error("Demo seller member not found.")
    return
  }
  const demoSellerMemberId = members[0].id

  // ── 4. Skip offer creation if offers already exist ─────────────────────────
  const { data: existingOffers } = await query.graph({
    entity: "offer",
    fields: ["id"],
    filters: { seller_id: demoSeller.id },
  }) as { data: Array<{ id: string }> }

  if (existingOffers.length > 0) {
    logger.info(`Offers already exist (${existingOffers.length}), skipping offer creation.`)
    logger.info("Fix complete ✔")
    return
  }

  // ── 5. Locate seeded products ──────────────────────────────────────────────
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "variants.id", "variants.sku"],
    filters: { handle: ["t-shirt", "sweatshirt", "sweatpants", "shorts"] },
  }) as { data: Array<{ id: string; variants: Array<{ id: string; sku: string | null }> }> }

  if (!products.length) {
    logger.error("No seeded products found. Run the full seed first.")
    return
  }

  // ── 6. Locate seller shipping profile ─────────────────────────────────────
  const { data: shippingProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id", "name"],
    filters: { name: "Ghana courier shipping" },
  }) as { data: Array<{ id: string }> }

  if (!shippingProfiles[0]) {
    logger.error("Seller shipping profile not found.")
    return
  }
  const shippingProfileId = shippingProfiles[0].id

  // ── 7. Locate seller stock location ───────────────────────────────────────
  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
    filters: { name: "Accra warehouse" },
  }) as { data: Array<{ id: string }> }

  if (!stockLocations[0]) {
    logger.error("Stock location not found.")
    return
  }
  const stockLocationId = stockLocations[0].id

  // ── 8. Create offers ───────────────────────────────────────────────────────
  logger.info(`Creating offers for ${products.length} products…`)
  const offers = products.flatMap((product) =>
    product.variants.map((variant) => ({
      seller_id: demoSeller.id,
      created_by: demoSellerMemberId,
      sku: `OFFER-${variant.sku}`,
      variant_id: variant.id,
      shipping_profile_id: shippingProfileId,
      inventory_items: [
        {
          sku: `OFFER-${variant.sku}`,
          stock_levels: [
            { location_id: stockLocationId, stocked_quantity: 1000000 },
          ],
        },
      ],
      prices: [{ amount: 85, currency_code: "ghs" }],
    }))
  )

  await createOffersWorkflow(container).run({ input: { offers } })
  logger.info(`Created ${offers.length} offers ✔`)
  logger.info("Fix complete ✔")
}
