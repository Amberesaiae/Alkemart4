import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { asList } from "../../../../../lib/graph-utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const sellerId = req.params.id
  if (!sellerId) {
    res.status(400).json({ error: "Seller id required" })
    return
  }

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
      graph: (args: unknown) => Promise<{ data: unknown }>
    }
    const { data } = await query.graph({
      entity: "seller",
      fields: [
        "id", "name", "handle", "email", "phone", "description",
        "status", "status_reason", "approved_at", "created_at",
        "address.address_1", "address.city", "address.country_code",
        "address.province", "address.postal_code",
        "metadata",
        "members.id", "members.is_owner",
        "members.member.id", "members.member.email",
        "members.member.first_name", "members.member.last_name",
      ],
      filters: { id: sellerId },
    })
    const sellers = asList(data)
    const seller = sellers[0]
    if (!seller) {
      res.status(404).json({ error: "Seller not found" })
      return
    }
    res.status(200).json({ seller })
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Failed to load seller",
    })
  }
}
