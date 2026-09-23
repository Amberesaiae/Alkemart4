import { describe, expect, it } from "vitest"
import { InMemoryCheckoutRepository } from "./checkout-repository"
import { demoCatalog } from "./demo-seed"
import {
  backoffDelaySeconds,
  consumeJobMessage,
  expiryDelaySeconds,
  intentExpiryMessage,
  notificationSweepMessage,
  publishJob,
  type AckableJobMessage,
  type ConsumeDeps,
} from "./jobs"
import { InMemorySmsProvider } from "./sms"

function deps(): ConsumeDeps & { checkout: InMemoryCheckoutRepository; sms: InMemorySmsProvider } {
  const checkout = new InMemoryCheckoutRepository(demoCatalog())
  const sms = new InMemorySmsProvider()
  return { checkout, sms }
}

function recorder(): AckableJobMessage & { acked: boolean; retries: { delaySeconds?: number }[] } {
  const rec = {
    attempts: 1,
    acked: false,
    retries: [] as { delaySeconds?: number }[],
    ack() {
      rec.acked = true
    },
    retry(opts?: { delaySeconds?: number }) {
      rec.retries.push(opts ?? {})
    },
  }
  return rec
}

async function createIntent(
  checkout: InMemoryCheckoutRepository,
  overrides: { id: string; method?: "momo" | "card" | "cod"; status?: "initiated" | "pending" | "failed" },
) {
  return checkout.createPaymentIntent({
    id: overrides.id,
    cartId: "cart-1",
    method: overrides.method ?? "momo",
    status: overrides.status ?? "pending",
    amountPesewas: 45000n,
    currency: "ghs",
    paystackReference: "alk_ref",
    buyerEmail: "buyer@alkemart.test",
    momoProvider: "mtn",
    momoPhone: "+233200000000",
    shippingAddress: null,
  })
}

describe("jobs consumer", () => {
  it("expires a stale pending momo intent and releases stock", async () => {
    const d = deps()
    await createIntent(d.checkout, { id: "intent-stale" })
    const msg = recorder()
    await consumeJobMessage(
      { ...d, nowMs: Date.now() + 2 * 60 * 60 * 1000 },
      intentExpiryMessage("intent-stale"),
      msg,
    )
    expect(msg.acked).toBe(true)
    expect((await d.checkout.getPaymentIntent("intent-stale"))?.status).toBe("expired")
  })

  it("re-schedules early redeliveries instead of expiring", async () => {
    const d = deps()
    await createIntent(d.checkout, { id: "intent-fresh" })
    const msg = recorder()
    await consumeJobMessage({ ...d }, intentExpiryMessage("intent-fresh"), msg)
    expect(msg.acked).toBe(false)
    expect(msg.retries).toHaveLength(1)
    expect(msg.retries[0]?.delaySeconds ?? 0).toBeGreaterThan(3000)
    expect((await d.checkout.getPaymentIntent("intent-fresh"))?.status).toBe("pending")
  })

  it("converges terminal and COD intents to noop", async () => {
    const d = deps()
    await createIntent(d.checkout, { id: "intent-dead", status: "failed" })
    await createIntent(d.checkout, { id: "intent-cod", method: "cod" })
    for (const id of ["intent-dead", "intent-cod", "intent-missing"]) {
      const msg = recorder()
      await consumeJobMessage(
        { ...d, nowMs: Date.now() + 9 * 60 * 60 * 1000 },
        intentExpiryMessage(id),
        msg,
      )
      expect(msg.acked).toBe(true)
      expect(msg.retries).toHaveLength(0)
    }
  })

  it("delivers due notifications exactly once across redeliveries", async () => {
    const d = deps()
    await d.checkout.enqueueNotification({
      key: "order-confirmed:o1",
      recipient: "+233200000001",
      body: "Order confirmed",
    })
    const sweep = notificationSweepMessage()
    const first = recorder()
    await consumeJobMessage({ ...d }, sweep, first)
    expect(first.acked).toBe(true)
    expect(d.sms.sent).toHaveLength(1)
    const second = recorder()
    await consumeJobMessage({ ...d }, sweep, second)
    expect(second.acked).toBe(true)
    expect(d.sms.sent).toHaveLength(1)
  })

  it("records SMS failures without throwing (claim converges)", async () => {
    const d = deps()
    d.sms.failNext = 99
    await d.checkout.enqueueNotification({
      key: "order-confirmed:o2",
      recipient: "+233200000002",
      body: "Order confirmed",
    })
    const msg = recorder()
    await consumeJobMessage({ ...d }, notificationSweepMessage(), msg)
    expect(msg.acked).toBe(true)
    expect(d.sms.sent).toHaveLength(0)
  })

  it("throws poison messages so they ride retries to the DLQ", async () => {
    const d = deps()
    await expect(
      consumeJobMessage({ ...d }, { kind: "nope" }, recorder()),
    ).rejects.toThrow()
  })

  it("backs off exponentially and caps at 24h", () => {
    expect(backoffDelaySeconds(1)).toBe(30)
    expect(backoffDelaySeconds(2)).toBe(900)
    expect(backoffDelaySeconds(99)).toBe(24 * 3600)
    expect(expiryDelaySeconds()).toBe(3600)
  })

  it("publishJob never breaks the request path", async () => {
    const throwing = {
      publish: async () => {
        throw new Error("queue down")
      },
    }
    await expect(
      publishJob(throwing, "notifications", notificationSweepMessage()),
    ).resolves.toBeUndefined()
  })
})
