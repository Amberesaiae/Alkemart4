import {
  detectImageMimeFromBuffer,
  validateImageUpload,
} from "../media/validate-image"

// Minimal magic-byte fixtures
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46])
const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
])
const webp = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from("WEBP"),
])

describe("validateImageUpload", () => {
  it("detects jpeg/png/webp", () => {
    expect(detectImageMimeFromBuffer(jpeg)).toBe("image/jpeg")
    expect(detectImageMimeFromBuffer(png)).toBe("image/png")
    expect(detectImageMimeFromBuffer(webp)).toBe("image/webp")
  })

  it("accepts valid jpeg", () => {
    expect(
      validateImageUpload({
        mime: "image/jpeg",
        buffer: jpeg,
        filename: "a.jpg",
      }),
    ).toEqual({ ok: true })
  })

  it("rejects empty and oversized", () => {
    expect(validateImageUpload({ size: 0 }).ok).toBe(false)
    expect(
      validateImageUpload({
        mime: "image/jpeg",
        size: 50 * 1024 * 1024,
        filename: "big.jpg",
      }).ok,
    ).toBe(false)
  })

  it("rejects non-image mime", () => {
    expect(
      validateImageUpload({
        mime: "application/pdf",
        size: 100,
        filename: "a.pdf",
      }).ok,
    ).toBe(false)
  })
})
