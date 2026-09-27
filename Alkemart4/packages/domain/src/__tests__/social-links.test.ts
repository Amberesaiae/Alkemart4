import { describe, expect, it } from "vitest"
import { normalizeSocial, socialHandle } from "../social-links"

const url = (r: ReturnType<typeof normalizeSocial>) => (r.ok ? r.url : `ERR ${r.message}`)

describe("normalizeSocial", () => {
  it("turns handles into canonical links", () => {
    expect(url(normalizeSocial("tiktok", "@accra.mart"))).toBe("https://www.tiktok.com/@accra.mart")
    expect(url(normalizeSocial("instagram", "accramart"))).toBe("https://www.instagram.com/accramart")
    expect(url(normalizeSocial("facebook", "Accra-Mart"))).toBe("https://www.facebook.com/Accra-Mart")
  })
  it("accepts pasted links with or without https, and mobile hosts", () => {
    expect(url(normalizeSocial("tiktok", "tiktok.com/@accramart/"))).toBe("https://tiktok.com/@accramart")
    expect(url(normalizeSocial("instagram", "https://instagram.com/accramart?igsh=abc"))).toBe("https://instagram.com/accramart")
    expect(url(normalizeSocial("facebook", "https://m.facebook.com/accramart"))).toBe("https://www.facebook.com/accramart")
  })
  it("turns local and international numbers into wa.me links", () => {
    expect(url(normalizeSocial("whatsapp", "024 412 3456"))).toBe("https://wa.me/233244123456")
    expect(url(normalizeSocial("whatsapp", "+233 24 412 3456"))).toBe("https://wa.me/233244123456")
    expect(url(normalizeSocial("whatsapp", "0712 345678", "254"))).toBe("https://wa.me/254712345678")
    expect(url(normalizeSocial("whatsapp", "https://wa.me/233244123456?text=hi"))).toBe("https://wa.me/233244123456")
  })
  it("treats empty as remove", () => {
    expect(normalizeSocial("tiktok", "  ")).toEqual({ ok: true, url: null })
    expect(normalizeSocial("whatsapp", null)).toEqual({ ok: true, url: null })
  })
  it("refuses look-alike hosts, bare homepages and junk", () => {
    expect(normalizeSocial("instagram", "https://instagram.com.evil.io/x").ok).toBe(false)
    expect(normalizeSocial("tiktok", "https://tiktok.com").ok).toBe(false)
    expect(normalizeSocial("tiktok", "my shop!").ok).toBe(false)
    expect(normalizeSocial("whatsapp", "call me").ok).toBe(false)
    expect(normalizeSocial("facebook", "https://instagram.com/x").ok).toBe(false)
  })
})

describe("socialHandle", () => {
  it("shows what buyers recognise", () => {
    expect(socialHandle("tiktok", "https://www.tiktok.com/@accramart")).toBe("@accramart")
    expect(socialHandle("instagram", "https://www.instagram.com/accramart")).toBe("@accramart")
    expect(socialHandle("whatsapp", "https://wa.me/233244123456")).toBe("+233244123456")
  })
})
