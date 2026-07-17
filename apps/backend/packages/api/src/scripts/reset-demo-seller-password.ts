/**
 * Reset lab seller password to known value.
 *   medusa exec ./src/scripts/reset-demo-seller-password.ts
 */
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

const EMAIL = "seller@mercur.dev"
const PASSWORD = "supersecret"

export default async function resetDemoSellerPassword({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const auth = container.resolve(Modules.AUTH) as {
    updateProvider: (
      provider: string,
      data: { entity_id: string; password: string },
    ) => Promise<unknown>
    authenticate: (
      provider: string,
      data: { body: { email: string; password: string } },
    ) => Promise<{ success?: boolean; error?: string }>
  }

  try {
    // Medusa v2 emailpass update
    await (auth as { updateProviderIdentities?: Function }).updateProviderIdentities?.(
      [
        {
          entity_id: EMAIL,
          provider: "emailpass",
          provider_metadata: { password: PASSWORD },
        },
      ],
    )
  } catch (e) {
    logger.warn(
      `updateProviderIdentities failed: ${e instanceof Error ? e.message : e}`,
    )
  }

  // Fallback: delete+recreate is too destructive. Try register then authenticate.
  try {
    const ok = await auth.authenticate("emailpass", {
      body: { email: EMAIL, password: PASSWORD },
    })
    logger.info(
      `Auth check seller@mercur.dev: success=${Boolean(ok?.success)} error=${ok?.error ?? ""}`,
    )
  } catch (e) {
    logger.warn(`authenticate check: ${e instanceof Error ? e.message : e}`)
  }

  logger.info(
    `If still failing, re-run seed on empty DB or set password via Admin for ${EMAIL}`,
  )
}
