import { describe, expect, it } from "vitest"
import { marketCurrency } from "@alkemart/shared/markets"
import { InMemoryCheckoutRepository } from "./checkout-repository"
import { demoCatalog } from "./demo-seed"

async function confirmedOrder(currency = marketCurrency()) {
  const checkout = new InMemoryCheckoutRepository(demoCatalog())
  const cart = await checkout.createCart()
  await checkout.addCartItem(cart.id, "offer-a", 1)
  const quote = await checkout.quote(cart.id)
  const intent = await checkout.createPaymentIntent({
    id: `intent-${Math.random().toString(36).slice(2)}`,
    cartId: cart.id,
    method: "cod",
    status: "initiated",
    amountPesewas: quote.totalPesewas,
    currency,
    paystackReference: null,
    buyerEmail: "buyer@alkemart.test",
    momoProvider: null,
    momoPhone: null,
    shippingAddress: null,
  })
  const { orders } = await checkout.confirmPaidOrder(intent.id)
  return { checkout, orders, intent }
}

describe("money ledger", () => {
  it("records sale + platform_fee per order at confirm", async () => {
    const { checkout, orders } = await confirmedOrder()
    expect(orders).toHaveLength(1)
    const rows = await checkout.ledger.listForOrder(orders[0]!.id)
    const kinds = rows.map((r) => r.kind).sort()
    expect(kinds).toEqual(["platform_fee", "sale"])
    const sale = rows.find((r) => r.kind === "sale")!
    const fee = rows.find((r) => r.kind === "platform_fee")!
    // offer-a: 1500 + delivery 500 (demo seed, seller-a @ 700bps)
    expect(sale.amountMinor).toBe(1500n)
    expect(sale.currency).toBe("GHS")
    expect(fee.amountMinor).toBe((1500n * 700n) / 10_000n)
    expect(fee.currency).toBe("GHS")
    expect(sale.marketCode).toBe("GH")
  })

  it("replay converges without duplicate rows", async () => {
    const { checkout, orders, intent } = await confirmedOrder()
    await checkout.confirmPaidOrder(intent.id)
    const rows = await checkout.ledger.listForOrder(orders[0]!.id)
    expect(rows).toHaveLength(2)
  })

  it("records payout rows and carries multi-currency intents", async () => {
    const { checkout, orders } = await confirmedOrder("USD")
    const rows = await checkout.ledger.listForOrder(orders[0]!.id)
    expect(rows.every((r) => r.currency === "USD")).toBe(true)

    const order = orders[0]!
    await checkout.updateOrderStatus(order.id, order.sellerId, "shipped")
    await checkout.updateOrderStatus(order.id, order.sellerId, "delivered")
    const payout = await checkout.createPayout({
      sellerId: order.sellerId,
      commissionBps: 700,
      paystackTransferCode: "TRF_x",
      paystackReference: "ref-x",
    })
    const sellerRows = await checkout.ledger.listForSeller(order.sellerId)
    const payoutRow = sellerRows.find((r) => r.kind === "payout")
    expect(payoutRow?.amountMinor).toBe(payout.netPesewas)
    expect(payoutRow?.currency).toBe("USD")
  })
})
