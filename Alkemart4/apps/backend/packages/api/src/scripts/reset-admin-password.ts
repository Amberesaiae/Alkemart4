import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

const EMAIL = "admin@alkemart.local"
const PASSWORD = process.env.ADMIN_PASSWORD || "supersecret"

export default async function resetAdminPassword({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const auth = container.resolve(Modules.AUTH) as {
    updateProvider: (
      provider: string,
      data: { entity_id: string; password: string },
    ) => Promise<{ success?: boolean; error?: string }>
    authenticate: (
      provider: string,
      data: { body: { email: string; password: string } },
    ) => Promise<{ success?: boolean; error?: string }>
  }

  try {
    const result = await auth.updateProvider("emailpass", {
      entity_id: EMAIL,
      password: PASSWORD,
    })
    logger.info(`updateProvider admin@alkemart.local: ${JSON.stringify(result)}`)
  } catch (e) {
    logger.warn(`updateProvider failed: ${e instanceof Error ? e.message : e}`)
  }

  try {
    const ok = await auth.authenticate("emailpass", {
      body: { email: EMAIL, password: PASSWORD },
    })
    logger.info(
      `Auth check admin@alkemart.local: success=${Boolean(ok?.success)} error=${ok?.error ?? ""}`,
    )
  } catch (e) {
    logger.warn(`authenticate check: ${e instanceof Error ? e.message : e}`)
  }
}
