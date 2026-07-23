import {
  productLifecycleEmail,
  sellerLifecycleEmail,
  sendEmail,
} from "../email"

describe("email templates", () => {
  it("builds seller lifecycle message", () => {
    const msg = sellerLifecycleEmail({
      to: "seller@example.com",
      shopName: "Tema Fresh",
      event: "seller.approved",
    })
    expect(msg.to).toBe("seller@example.com")
    expect(msg.subject).toMatch(/approved/i)
    expect(msg.text).toContain("Tema Fresh")
  })

  it("builds product reject message", () => {
    const msg = productLifecycleEmail({
      to: "seller@example.com",
      productTitle: "Palm Oil",
      event: "product.rejected",
      message: "[poor_images] blurry",
    })
    expect(msg.subject).toMatch(/not approved/i)
    expect(msg.text).toContain("poor_images")
  })
})

describe("sendEmail", () => {
  it("log mode succeeds without SMTP keys", async () => {
    const prev = process.env.RESEND_API_KEY
    const smtp = process.env.SMTP_HOST
    delete process.env.RESEND_API_KEY
    delete process.env.SMTP_HOST
    const result = await sendEmail({
      to: "a@b.com",
      subject: "t",
      text: "hello",
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.mode).toBe("log")
    if (prev) process.env.RESEND_API_KEY = prev
    if (smtp) process.env.SMTP_HOST = smtp
  })

  it("rejects bad recipient", async () => {
    const result = await sendEmail({
      to: "not-an-email",
      subject: "t",
      text: "x",
    })
    expect(result.ok).toBe(false)
  })
})
