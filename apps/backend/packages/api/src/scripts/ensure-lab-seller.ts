/**
 * Ensure lab seller seller@alkemart.local exists, is approved, and can open Seller Hub.
 * Run: bunx medusa exec ./src/scripts/ensure-lab-seller.ts
 */
import { ExecArgs, Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createSellerAccountWorkflow,
  approveSellerWorkflow,
} from "@mercurjs/core/workflows"

const SELLER_EMAIL = "seller@alkemart.local"
const SELLER_PASSWORD = "supersecret"

export default async function ensureLabSeller({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const authModuleService = container.resolve(Modules.AUTH)

  const { data: existing } = await query.graph({
    entity: "seller",
    fields: ["id", "name", "email", "status"],
    filters: { email: SELLER_EMAIL },
  })

  if (existing[0]) {
    logger.info(`Lab seller already exists: ${existing[0].id} (${existing[0].status})`)
    if (existing[0].status !== "open") {
      await approveSellerWorkflow(container).run({
        input: { seller_id: existing[0].id },
      })
      logger.info("Approved lab seller.")
    }
    return
  }

  logger.info(`Creating lab seller ${SELLER_EMAIL}...`)

  let authIdentityId: string
  const registerResponse = await authModuleService.register("emailpass", {
    body: { email: SELLER_EMAIL, password: SELLER_PASSWORD },
  })

  if (registerResponse.success && registerResponse.authIdentity) {
    authIdentityId = registerResponse.authIdentity.id
  } else {
    const [providerIdentity] = await authModuleService.listProviderIdentities({
      entity_id: SELLER_EMAIL,
      provider: "emailpass",
    })
    if (!providerIdentity?.auth_identity_id) {
      throw new Error(
        `Could not register or find auth identity for ${SELLER_EMAIL}`
      )
    }
    authIdentityId = providerIdentity.auth_identity_id
  }

  const { result: seller } = await createSellerAccountWorkflow(container).run({
    input: {
      auth_identity_id: authIdentityId,
      member_email: SELLER_EMAIL,
      first_name: "Lab",
      last_name: "Seller",
      seller: {
        name: "Alkemart Lab Shop",
        email: SELLER_EMAIL,
        currency_code: "ghs",
        description: "Lab marketplace seller for Ghana COD / MoMo testing.",
      },
    },
  })

  await approveSellerWorkflow(container).run({
    input: { seller_id: seller.id },
  })

  logger.info(`Lab seller ready: ${seller.id} / ${SELLER_EMAIL} / ${SELLER_PASSWORD}`)
}
