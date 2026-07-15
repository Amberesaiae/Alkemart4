import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

async function linkProducts({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const productModule = container.resolve(Modules.PRODUCT)
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL)

  const productResult = await productModule.listProducts({})
  const products = Array.isArray(productResult) ? productResult : (productResult as any)?.products ?? []
  logger.info(`Found ${products.length} products`)

  const channelResult = await salesChannelModule.listSalesChannels({})
  const channelList = Array.isArray(channelResult) ? channelResult : (channelResult as any)?.sales_channels ?? []
  logger.info(`Found ${channelList.length} sales channels`)

  for (const sc of channelList) {
    logger.info(`\nLinking all products to: ${sc.name} (${sc.id})`)
    for (const p of products) {
      try {
        await productModule.updateProducts(p.id, {
          sales_channels: [{ id: sc.id }],
        } as any)
        logger.info(`  Linked "${p.title}"`)
      } catch (err: any) {
        logger.warn(`  Failed "${p.title}": ${err.message?.substring(0, 100)}`)
      }
    }
  }

  logger.info("\nDone!")
}

export default linkProducts
