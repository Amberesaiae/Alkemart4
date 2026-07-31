import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

type MemberRow = {
  id: string
  name?: string | null
  email?: string | null
  seller?: { id: string; name?: string | null } | null
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  // Medusa attaches auth_context after authenticate middleware; not on base types
  const auth = (req as MedusaRequest & {
    auth_context?: { actor_id?: string; auth_identity_id?: string }
  }).auth_context

  if (!auth) {
    res.status(401).json({ error: "Not authenticated" })
    return
  }

  // actor_id is empty — user has a valid JWT but hasn't registered as a
  // seller yet. Tell the SPA to show the registration form.
  if (!auth.actor_id) {
    res.status(404).json({
      error: "No seller member found",
      detail: "register_seller",
    })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  try {
    const { data } = await query.graph({
      entity: "seller_member",
      fields: ["id", "name", "email", "member.id", "seller.id", "seller.name"],
      filters: { member_id: auth.actor_id },
    })

    const list = Array.isArray(data) ? data : [data].filter(Boolean)
    const member = list[0] as MemberRow | undefined

    if (!member) {
      res.status(404).json({ error: "Seller member not found" })
      return
    }

    res.status(200).json({
      id: member.id,
      name: member.name ?? null,
      email: member.email ?? null,
      seller_id: member.seller?.id ?? null,
      seller_name: member.seller?.name ?? null,
    })
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Failed to get seller info",
    })
  }
}
