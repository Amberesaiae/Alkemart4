import { orderReference } from "@alkemart/shared/order-ref"
import type { Context } from "hono"
import type { CheckoutRepository, OrderGroupRow, OrderRow } from "../checkout-repository"
import type { AppEnv } from "../context"
import { encodeEmail } from "../email"
import { orderPlacedEmail, orderStatusEmail, sellerNewOrderEmail } from "./email-templates"
import { formatMinorForEmail } from "./money-format"

/**
 * Order emails, enqueued into the outbox. Keys are deterministic
 * (`order-placed:{group}`, `seller-new-order:{order}`, `order-{status}:{order}`)
 * so webhook retries, status polls and double taps never send twice.
 * Never throws: a mail problem must not fail a checkout or a status change.
 */
export type OrderEmailLinks = {
  storefrontUrl: string | null
  vendorUrl: string | null
  /** Owner email of a shop, when an auth repo is available on this path. */
  sellerEmail?: (sellerId: string) => Promise<string | null>
  /** Shop name, for lines like "Your code for Accra Mart". */
  sellerName?: (sellerId: string) => Promise<string | null>
}

const when = (d: Date | null | undefined) =>
  d ? new Intl.DateTimeFormat("en", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(d) : null

export async function enqueueOrderPlacedEmails(
  checkout: CheckoutRepository,
  input: { group: OrderGroupRow; orders: OrderRow[]; method: string | null; links: OrderEmailLinks },
) {
  const { group, orders, links } = input
  const ref = orderReference(group.id)
  try {
    const handover = []
    for (const o of orders) {
      if (!o.handoverCode) continue
      const seller = (await links.sellerName?.(o.sellerId).catch(() => null)) ?? "the seller"
      handover.push({ code: o.handoverCode, seller, pickup: o.fulfillmentMethod === "pickup" })
    }
    if (links.storefrontUrl) {
      await checkout.enqueueNotification({
        key: `order-placed:${group.id}`,
        recipient: group.buyerEmail,
        channel: "email",
        category: "transactional",
        body: encodeEmail(
          orderPlacedEmail({
            reference: ref,
            total: formatMinorForEmail(group.totalPesewas, group.currency),
            url: `${links.storefrontUrl}/order/${group.id}`,
            payOnDelivery: input.method === "cod",
            handover,
          }),
        ),
      })
    }
    if (links.vendorUrl && links.sellerEmail) {
      for (const o of orders) {
        const to = await links.sellerEmail(o.sellerId).catch(() => null)
        if (!to) continue
        const items = await checkout.listOrderItems(o.id).catch(() => [])
        await checkout.enqueueNotification({
          key: `seller-new-order:${o.id}`,
          recipient: to,
          channel: "email",
          category: "operational",
          body: encodeEmail(
            sellerNewOrderEmail({
              reference: ref,
              items: items.map((i) => `${i.qty} × ${i.title}`).join(", ") || "see the order",
              sendBy: when(o.dispatchBy),
              url: `${links.vendorUrl}/orders/${o.id}`,
            }),
          ),
        })
      }
    }
  } catch (err) {
    console.error(JSON.stringify({ job: "order-email-enqueue", error: err instanceof Error ? err.message : String(err) }))
  }
}

export async function enqueueOrderStatusEmail(
  checkout: CheckoutRepository,
  input: { order: OrderRow; status: "shipped" | "delivered"; sellerName: string; links: OrderEmailLinks },
) {
  const { order, links } = input
  if (!links.storefrontUrl) return
  try {
    const group = await checkout.getOrderGroup(order.orderGroupId)
    if (!group) return
    const eta =
      input.status === "shipped" && order.deliverLatest
        ? `by ${new Intl.DateTimeFormat("en", { weekday: "short", day: "numeric", month: "short" }).format(order.deliverLatest)}`
        : null
    await checkout.enqueueNotification({
      key: `order-${input.status}:${order.id}`,
      recipient: group.buyerEmail,
      channel: "email",
      category: "transactional",
      body: encodeEmail(
        orderStatusEmail({
          reference: orderReference(group.id),
          status: input.status,
          sellerName: input.sellerName,
          url: `${links.storefrontUrl}/order/${group.id}`,
          eta,
        }),
      ),
    })
  } catch (err) {
    console.error(JSON.stringify({ job: "order-email-enqueue", error: err instanceof Error ? err.message : String(err) }))
  }
}

/** Links for email from configuration only (never request headers). */
export function orderEmailLinks(c: Context<AppEnv>): OrderEmailLinks {
  const env = (c.env ?? {}) as unknown as Record<string, string | undefined>
  const dev = (env.ENVIRONMENT ?? "development") === "development"
  const auth = (() => {
    try {
      return c.get("authRepo")
    } catch {
      return undefined
    }
  })()
  return {
    storefrontUrl: (env.STOREFRONT_URL ?? (dev ? "http://localhost:5176" : null))?.replace(/\/$/, "") ?? null,
    vendorUrl: (env.VENDOR_URL ?? (dev ? "http://localhost:3004" : null))?.replace(/\/$/, "") ?? null,
    sellerEmail: auth
      ? async (sellerId) => {
          const members = await auth.listSellerMembers(sellerId)
          return members.find((m) => m.role === "owner")?.email ?? members[0]?.email ?? null
        }
      : undefined,
    sellerName: auth ? async (sellerId) => (await auth.findSellerById(sellerId))?.name ?? null : undefined,
  }
}
