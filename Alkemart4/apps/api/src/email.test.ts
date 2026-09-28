import { describe, expect, it, vi } from "vitest"
import { emailProviderFromEnv, LogEmailProvider, ResendEmailProvider } from "./email"

const input = { to: "private@example.com", subject: "Verify", html: "<p>private-token</p>", text: "private-token", idempotencyKey: "notification-1" }
describe("transactional email safety", () => {
  it.each(["production", "staging"])("fails closed without a provider in %s", async (ENVIRONMENT) => {
    await expect(emailProviderFromEnv({ ENVIRONMENT }).send(input)).rejects.toThrow("not configured")
  })
  it("never logs addresses or verification links from the development stub", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {})
    try {
      await new LogEmailProvider().send(input)
      const output = JSON.stringify(spy.mock.calls)
      expect(output).not.toContain(input.to)
      expect(output).not.toContain("private-token")
    } finally { spy.mockRestore() }
  })
  it("bounds requests and passes a stable idempotency key", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ id: "sent-1" }))
    await expect(new ResendEmailProvider({ apiKey: "test-key", from: "sender@example.com" }, fetcher).send(input)).resolves.toEqual({ messageId: "sent-1" })
    const options = fetcher.mock.calls[0]![1]!
    expect(new Headers(options.headers).get("Idempotency-Key")).toBe("notification-1")
    expect(options.redirect).toBe("error")
    expect(options.signal).toBeInstanceOf(AbortSignal)
  })
  it("does not expose provider response details", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ message: "private-token" }, { status: 400 }))
    await expect(new ResendEmailProvider({ apiKey: "test-key", from: "sender@example.com" }, fetcher).send(input)).rejects.toThrow("Resend rejected email (400)")
  })
})
