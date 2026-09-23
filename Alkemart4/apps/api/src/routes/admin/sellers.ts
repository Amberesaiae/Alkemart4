import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AuthSeller } from "../../auth-repository"
import { CatalogValidationError, type AdminProductDto } from "../../catalog-repository"
import type { OrderRow } from "../../checkout-repository"
import type { AppEnv } from "../../context"
import { readJsonBody } from "../../lib/session"
import { requireAdmin } from "../../middleware/auth"

const CommissionBody = z.object({
  commissionBps: z.number().int().min(0).max(10_000),
})

const IssueVerificationBody = z.object({
  kind: z.enum(["contact", "identity", "business", "brand_auth", "fulfillment_proven"]),
  evidence: z.string().trim().min(1).max(2000).optional().nullable(),
  issuedBy: z.string().trim().min(1).max(200).optional(),
  expiresAt: z.string().trim().min(1).max(64).optional().nullable(),
})

const RevokeVerificationBody = z.object({
  reason: z.string().trim().min(1).max(1000),
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
    const authRepo = c.get("authRepo")
    const [sellers, totals] = await Promise.all([
      authRepo.listSellers(),
      c.get("checkoutRepo").orderTotalsBySeller().catch(() => new Map()),
    ])
    // Owner contact per shop for the ops queue. One members read per shop —
    // admin-scale only, never on a shopper path.
    const owners = await Promise.all(
      sellers.map((s) =>
        authRepo
          .listSellerMembers(s.id)
          .then(
            (members) =>
              members.find((m) => m.role === "owner")?.email ?? members[0]?.email ?? null,
          )
          .catch(() => null),
      ),
    )
    return c.json({
      items: sellers.map((s, i) => {
        const t = (totals as Map<string, { orders: number; gmvPesewas: bigint }>).get(s.id)
        return {
          ...publicSeller(s),
          ownerEmail: owners[i],
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

    // Degraded sources resolve to explicit partial flags — the detail page
    // states incompleteness instead of presenting zeros as facts.
    const [members, products, orders] = await Promise.all([
      authRepo.listSellerMembers(id),
      c.get("repo").listAdminProducts().then(
        (rows): { rows: AdminProductDto[]; partial: false } => ({ rows, partial: false }),
        (): { rows: AdminProductDto[]; partial: true } => ({ rows: [], partial: true }),
      ),
      c.get("checkoutRepo").listOrdersForSeller(id).then(
        (rows): { rows: OrderRow[]; partial: false } => ({ rows, partial: false }),
        (): { rows: OrderRow[]; partial: true } => ({ rows: [], partial: true }),
      ),
    ])
    const mine = products.rows.filter((p) => p.sellerId === id)
    const productCounts = { draft: 0, proposed: 0, published: 0, rejected: 0 }
    for (const p of mine) productCounts[p.status] = (productCounts[p.status] ?? 0) + 1
    const orderCounts: Record<string, number> = {}
    for (const o of orders.rows) orderCounts[o.status] = (orderCounts[o.status] ?? 0) + 1
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
        partial: products.partial || orders.partial,
      },
      recentOrders: orders.rows.slice(0, 5).map((o) => ({
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
  /**
   * Phase 3D — verification evidence governance. Issuing records what was
   * checked (contact/identity/business/brand_auth/fulfillment_proven);
   * revoking names a reason. Both are audit-logged.
   */
  .get("/:id/verifications", async (c) => {
    const seller = await c.get("authRepo").findSellerById(c.req.param("id"))
    if (!seller) throw new HTTPException(404, { message: "seller not found" })
    const verifications = await c.get("repo").listSellerVerifications(seller.id)
    return c.json({ sellerId: seller.id, verifications })
  })
  .post("/:id/verifications", async (c) => {
    const parsed = IssueVerificationBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const seller = await c.get("authRepo").findSellerById(c.req.param("id"))
    if (!seller) throw new HTTPException(404, { message: "seller not found" })
    try {
      const verification = await c
        .get("repo")
        .issueSellerVerification(seller.id, parsed.data.kind, {
          evidence: parsed.data.evidence ?? null,
          issuedBy: parsed.data.issuedBy ?? c.get("auth").userId,
          expiresAt: parsed.data.expiresAt ?? null,
        })
      await c.get("auditLog").log({
        adminUserId: c.get("auth").userId,
        action: "seller.verification.issue",
        targetType: "seller",
        targetId: seller.id,
        detail: { kind: verification.kind, verificationId: verification.id },
      })
      return c.json({ verification }, 201)
    } catch (err) {
      if (err instanceof CatalogValidationError) throw new HTTPException(400, { message: err.message })
      throw err
    }
  })
  .post("/:id/verifications/:verificationId/revoke", async (c) => {
    const parsed = RevokeVerificationBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const seller = await c.get("authRepo").findSellerById(c.req.param("id"))
    if (!seller) throw new HTTPException(404, { message: "seller not found" })
    try {
      const verification = await c.get("repo").revokeSellerVerification(c.req.param("verificationId"), {
        reason: parsed.data.reason,
        revokedBy: c.get("auth").userId,
      })
      if (!verification) throw new HTTPException(404, { message: "verification not found" })
      await c.get("auditLog").log({
        adminUserId: c.get("auth").userId,
        action: "seller.verification.revoke",
        targetType: "seller",
        targetId: seller.id,
        detail: { verificationId: verification.id, reason: parsed.data.reason },
      })
      return c.json({ verification })
    } catch (err) {
      if (err instanceof HTTPException) throw err
      if (err instanceof CatalogValidationError) throw new HTTPException(400, { message: err.message })
      throw err
    }
  })
