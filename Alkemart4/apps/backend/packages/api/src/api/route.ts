import type { MedusaRequest, MedusaResponse } from "@medusajs/medusa"

/**
 * Redirect the bare root to the admin dashboard so the Replit
 * preview (and any browser hitting port 9000 directly) lands somewhere useful.
 */
export const GET = (req: MedusaRequest, res: MedusaResponse) => {
  res.redirect("/dashboard")
}
