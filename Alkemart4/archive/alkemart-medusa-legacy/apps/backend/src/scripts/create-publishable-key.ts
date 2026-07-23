import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createApiKeysWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
} from "@medusajs/medusa/core-flows"

const PREFERRED_SALES_CHANNEL_NAME = "Alkemart Storefront"

/**
 * Ensure a single publishable API key is linked to exactly ONE sales channel.
 *
 * Linking more than one channel causes storefront cart errors:
 * "Cannot assign sales channel to cart. The Publishable API Key has multiple
 * associated sales channels."
 */
async function ensurePublishableKeySingleChannel({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const apiKeyModule = container.resolve(Modules.API_KEY)
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  // --- 1. Publishable API key: first existing, or create one ---
  let keys = await apiKeyModule.listApiKeys({ type: "publishable" })
  let key = Array.isArray(keys) ? keys[0] : undefined

  if (!key) {
    logger.info("No publishable API key found — creating one…")
    const { result } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [
          {
            title: PREFERRED_SALES_CHANNEL_NAME,
            type: "publishable",
            created_by: "",
          },
        ],
      },
    })
    key = result[0]
    if (!key) {
      logger.error("Failed to create publishable API key")
      return
    }
    logger.info(`Created publishable API key id=${key.id}`)
  } else {
    logger.info(`Using existing publishable API key id=${key.id}`)
  }

  const tokenPrefix =
    typeof key.token === "string" && key.token.length > 0
      ? key.token.slice(0, 12)
      : "(no-token)"

  // --- 2. Sales channel: prefer "Alkemart Storefront", else first ---
  const channelResult = await salesChannelModule.listSalesChannels({})
  const channels = Array.isArray(channelResult)
    ? channelResult
    : ((channelResult as { sales_channels?: { id: string; name: string }[] })
        ?.sales_channels ?? [])

  if (!channels.length) {
    logger.error("No sales channels found — seed store data first")
    return
  }

  let preferred = channels.find((c) => c.name === PREFERRED_SALES_CHANNEL_NAME)
  if (!preferred) {
    preferred = channels[0]
    logger.warn(
      `Sales channel "${PREFERRED_SALES_CHANNEL_NAME}" not found; ` +
        `falling back to first channel "${preferred.name}" (${preferred.id})`
    )
  } else {
    logger.info(
      `Preferred sales channel "${preferred.name}" id=${preferred.id}`
    )
  }

  // --- 3. Link key to ONLY that channel (remove any extras) ---
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
          linked
            .map((sc) => `${sc.name ?? "?"} (${sc.id})`)
            .join(", ")
      )
    }
  } catch (err) {
    logger.warn(
      `Could not query existing key↔channel links (will still add preferred): ${err}`
    )
  }

  const toRemove = currentlyLinkedIds.filter((id) => id !== preferred.id)
  const needsAdd = !currentlyLinkedIds.includes(preferred.id)

  if (!toRemove.length && !needsAdd) {
    logger.info(
      "Publishable key already linked to exactly the preferred sales channel — no change"
    )
  } else {
    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: {
        id: key.id,
        add: needsAdd ? [preferred.id] : [],
        remove: toRemove,
      },
    })
    if (toRemove.length) {
      logger.info(`Removed ${toRemove.length} extra sales channel link(s)`)
    }
    if (needsAdd) {
      logger.info(`Linked key to sales channel ${preferred.id}`)
    }
  }

  // --- 4. Ops-friendly summary (prefix, not full secret unless needed) ---
  logger.info("——— Storefront env wiring ———")
  logger.info(`Publishable key id:     ${key.id}`)
  logger.info(`Publishable key prefix: ${tokenPrefix}…`)
  if (typeof key.token === "string" && key.token.length > 0) {
    // Publishable tokens are safe for SPA env; log full for ops convenience.
    logger.info(`Publishable key token:  ${key.token}`)
  }
  logger.info(`Sales channel id:       ${preferred.id}`)
  logger.info(`Sales channel name:     ${preferred.name}`)
  logger.info(
    "Region note: set ALKEMART_REGION_ID / VITE_MEDUSA_REGION_ID from " +
      "`npx medusa exec ./src/scripts/print-commerce-context.ts` " +
      "(or Admin → Settings → Regions). Cart/region must match storefront currency."
  )
  logger.info(
    "SPA: VITE_MEDUSA_PUBLISHABLE_KEY + VITE_MEDUSA_SALES_CHANNEL_ID + VITE_MEDUSA_REGION_ID"
  )
  logger.info(
    "Backend: ALKEMART_PUBLISHABLE_KEY + ALKEMART_SALES_CHANNEL_ID + ALKEMART_REGION_ID"
  )
}

export default ensurePublishableKeySingleChannel
