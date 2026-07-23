import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Print regions + sales channels (ids) for SPA / backend env population.
 *
 * Usage:
 *   npx medusa exec ./src/scripts/print-commerce-context.ts
 */
async function printCommerceContext({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const regionModule = container.resolve(Modules.REGION)
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL)
  const apiKeyModule = container.resolve(Modules.API_KEY)

  const regionResult = await regionModule.listRegions({})
  const regions = Array.isArray(regionResult)
    ? regionResult
    : ((regionResult as { regions?: { id: string; name: string; currency_code?: string }[] })
        ?.regions ?? [])

  logger.info("——— Regions ———")
  if (!regions.length) {
    logger.warn("No regions found")
  } else {
    for (const r of regions) {
      logger.info(
        `  ${r.name}  id=${r.id}  currency=${r.currency_code ?? "?"}`
      )
    }
  }

  const channelResult = await salesChannelModule.listSalesChannels({})
  const channels = Array.isArray(channelResult)
    ? channelResult
    : ((channelResult as { sales_channels?: { id: string; name: string }[] })
        ?.sales_channels ?? [])

  logger.info("——— Sales channels ———")
  if (!channels.length) {
    logger.warn("No sales channels found")
  } else {
    for (const sc of channels) {
      const preferred = sc.name === "Alkemart Storefront" ? "  ← preferred" : ""
      logger.info(`  ${sc.name}  id=${sc.id}${preferred}`)
    }
  }

  const keys = await apiKeyModule.listApiKeys({ type: "publishable" })
  const keyList = Array.isArray(keys) ? keys : []
  logger.info("——— Publishable API keys ———")
  if (!keyList.length) {
    logger.warn("No publishable keys — run create-publishable-key.ts")
  } else {
    for (const k of keyList) {
      const prefix =
        typeof k.token === "string" ? k.token.slice(0, 12) + "…" : "(no-token)"
      logger.info(`  id=${k.id}  title=${k.title ?? "?"}  token=${prefix}`)
    }
  }

  const preferredSc =
    channels.find((c) => c.name === "Alkemart Storefront") ?? channels[0]
  const ghana =
    regions.find((r) => /ghana/i.test(r.name)) ??
    regions.find((r) => (r.currency_code ?? "").toLowerCase() === "ghs") ??
    regions[0]
  const key = keyList[0]

  logger.info("——— Suggested env ———")
  if (ghana) {
    logger.info(`ALKEMART_REGION_ID=${ghana.id}`)
    logger.info(`VITE_MEDUSA_REGION_ID=${ghana.id}`)
  }
  if (preferredSc) {
    logger.info(`ALKEMART_SALES_CHANNEL_ID=${preferredSc.id}`)
    logger.info(`VITE_MEDUSA_SALES_CHANNEL_ID=${preferredSc.id}`)
  }
  if (key?.token) {
    logger.info(`ALKEMART_PUBLISHABLE_KEY=${key.token}`)
    logger.info(`VITE_MEDUSA_PUBLISHABLE_KEY=${key.token}`)
  }
}

export default printCommerceContext
