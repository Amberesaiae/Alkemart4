import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AuthSeller } from "../../auth-repository"
import type { AdminProductDto } from "../../catalog-repository"
import type { OrderRow } from "../../checkout-repository"
import type { AppEnv } from "../../context"
import { readJsonBody } from "../../lib/session"
import { requireAdmin } from "../../middleware/auth"

const CommissionBody = z.object({
  commissionBps: z.number().int().min(0).max(10_000),
})

function publicSeller(seller: AuthSeller) {
  return {
    id: seller.id,
    handle: seller.handle,
    name: seller.name,
    status: seller.status,
    commissionBps: seller.commissionBps,
    createdAt: seller.createdAt.toISOString(),
  }
}

export const adminSellers = new Hono<AppEnv>()
  .use("*", requireAdmin)
  .get("/", async (c) => {
    const [sellers, totals] = await Promise.all([
      c.get("authRepo").listSellers(),
      c.get("checkoutRepo").orderTotalsBySeller().catch(() => new Map()),
    ])
    return c.json({
      items: sellers.map((s) => {
        const t = (totals as Map<string, { orders: number; gmvPesewas: bigint }>).get(s.id)
        return {
          ...publicSeller(s),
          orderCount: t?.orders ?? 0,
          gmvPesewas: (t?.gmvPesewas ?? 0n).toString(),
        }
      }),
    })
  })
  .get("/:id", async (c) => {
    const id = c.req.param("id")
    const authRepo = c.get("authRepo")
    const seller = await authRepo.findSellerById(id)
    if (!seller) throw new HTTPException(404, { message: "seller not found" })

    const [members, products, orders] = await Promise.all([
      authRepo.listSellerMembers(id),
      c.get("repo").listAdminProducts().catch((): AdminProductDto[] => []),
      c.get("checkoutRepo").listOrdersForSeller(id).catch((): OrderRow[] => []),
    ])
    const mine = products.filter((p) => p.sellerId === id)
    const productCounts = { draft: 0, proposed: 0, published: 0, rejected: 0 }
    for (const p of mine) productCounts[p.status] = (productCounts[p.status] ?? 0) + 1
    const orderCounts: Record<string, number> = {}
    for (const o of orders) orderCounts[o.status] = (orderCounts[o.status] ?? 0) + 1
    const ownerEmail = members.find((m) => m.role === "owner")?.email ?? members[0]?.email ?? null

    return c.json({
      seller: {
        id: seller.id,
        handle: seller.handle,
        name: seller.name,
        description: seller.description,
        logo: seller.logo,
        banner: seller.banner,
        email: ownerEmail,
        phone: seller.momoPhone,
        status: seller.status,
        status_reason: null,
        approved_at: null,
        created_at: seller.createdAt.toISOString(),
        commissionBps: seller.commissionBps,
        address: seller.packRegion || seller.digitalAddress
          ? { province: seller.packRegion, postal_code: seller.digitalAddress }
          : null,
        momo: seller.momoPhone
          ? { provider: seller.momoProvider, phone: seller.momoPhone, recipient: Boolean(seller.recipientCode) }
          : null,
        members: members.map((m) => ({
          id: m.userId,
          is_owner: m.role === "owner",
          member: { email: m.email },
        })),
      },
      counts: {
        products: productCounts,
        orders: orderCounts,
        members: members.length,
      },
      recentOrders: orders.slice(0, 5).map((o) => ({
        id: o.id,
        status: o.status,
        subtotalPesewas: o.subtotalPesewas.toString(),
      })),
    })
  })
  .post("/:id/approve", async (c) => {
    const seller = await c.get("authRepo").updateSellerStatus(c.req.param("id"), "open")
    if (!seller) throw new HTTPException(404, { message: "seller not found" })
    await c.get("auditLog").log({
      adminUserId: c.get("auth").userId,
      action: "seller.approve",
      targetType: "seller",
      targetId: seller.id,
      detail: { handle: seller.handle },
    })
    return c.json({ seller: publicSeller(seller) })
  })
  .post("/:id/suspend", async (c) => {
    const rawBody: unknown = await readJsonBody(c).catch(() => ({}))
    const reason =
      typeof rawBody === "object" && rawBody !== null && typeof (rawBody as { reason?: unknown }).reason === "string"
        ? (rawBody as { reason: string }).reason.trim().slice(0, 500)
        : ""
    const seller = await c.get("authRepo").updateSellerStatus(c.req.param("id"), "suspended")
    if (!seller) throw new HTTPException(404, { message: "seller not found" })
    if (reason) {
      await c.get("authRepo").patchSellerMetadata(seller.id, { suspension_reason: reason })
    }
    await c.get("auditLog").log({
      adminUserId: c.get("auth").userId,
      action: "seller.suspend",
      targetType: "seller",
      targetId: seller.id,
      detail: { handle: seller.handle, status: seller.status, ...(reason ? { reason } : {}) },
    })
    return c.json({ seller: publicSeller(seller) })
  })
  .post("/:id/unsuspend", async (c) => {
    const seller = await c.get("authRepo").updateSellerStatus(c.req.param("id"), "open")
    if (!seller) throw new HTTPException(404, { message: "seller not found" })
    await c.get("auditLog").log({
      adminUserId: c.get("auth").userId,
      action: "seller.unsuspend",
      targetType: "seller",
      targetId: seller.id,
      detail: { handle: seller.handle, status: seller.status },
    })
    return c.json({ seller: publicSeller(seller) })
  })
  .post("/:id/terminate", async (c) => {
    const seller = await c.get("authRepo").updateSellerStatus(c.req.param("id"), "terminated")
    if (!seller) throw new HTTPException(404, { message: "seller not found" })
    await c.get("auditLog").log({
      adminUserId: c.get("auth").userId,
      action: "seller.terminate",
      targetType: "seller",
      targetId: seller.id,
      detail: { handle: seller.handle, status: seller.status },
    })
    return c.json({ seller: publicSeller(seller) })
  })
  .post("/:id/commission", async (c) => {
    const parsed = CommissionBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const seller = await c.get("authRepo").updateSellerCommission(
      c.req.param("id"),
      parsed.data.commissionBps,
    )
    if (!seller) throw new HTTPException(404, { message: "seller not found" })
    await c.get("auditLog").log({
      adminUserId: c.get("auth").userId,
      action: "seller.commission",
      targetType: "seller",
      targetId: seller.id,
      detail: { commissionBps: seller.commissionBps },
    })
    return c.json({ seller: publicSeller(seller) })
  })
