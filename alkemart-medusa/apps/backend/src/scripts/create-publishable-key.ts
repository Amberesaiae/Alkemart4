import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

async function linkApiKeyToSalesChannel({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const apiKeyModule = container.resolve(Modules.API_KEY)
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL)

  const keys = await apiKeyModule.listApiKeys({ type: "publishable" })
  if (!keys.length) {
    logger.error("No publishable API key found")
    return
  }
  const key = keys[0]
  logger.info(`Publishable key: ${key.token} (id: ${key.id})`)

  const channels = await salesChannelModule.listSalesChannels({})
  const sc = Array.isArray(channels) ? channels[0] : (channels as any)?.[0]
  if (!sc) {
    logger.error("No sales channel found")
    return
  }
  logger.info(`Sales channel: ${sc.name} (${sc.id})`)

  // Update with title required + link to sales channel
  try {
    await apiKeyModule.updateApiKeys(key.id, {
      title: key.title || "Alkemart Storefront",
      sales_channels: [{ id: sc.id }],
    })
    logger.info("Linked API key to Default Sales Channel!")
  } catch (err) {
    logger.error(`Failed: ${err}`)
  }

  // Also link to Alkemart Storefront channel
  const alkemartSc = (channels as any[]).find((c: any) => c.name === "Alkemart Storefront")
  if (alkemartSc) {
    try {
      await apiKeyModule.updateApiKeys(key.id, {
        title: key.title || "Alkemart Storefront",
        sales_channels: [{ id: sc.id }, { id: alkemartSc.id }],
      })
      logger.info("Also linked to Alkemart Storefront channel!")
    } catch (err) {
      logger.warn(`Second link failed: ${err}`)
    }
  }
}

export default linkApiKeyToSalesChannel
