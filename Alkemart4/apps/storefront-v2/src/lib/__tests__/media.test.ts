import { describe, expect, it } from "vitest"
import { thumbOf } from "@alkemart/shared/media"

describe("thumbOf", () => {
  it("points an uploaded WebP at its 400px thumb", () => {
    expect(thumbOf("https://api.example/media/products/seller-a/0b1c-2d.webp")).toBe("https://api.example/media/products/seller-a/0b1c-2d.thumb.webp")
  })

  it("works for photos on the public media domain too", () => {
    expect(thumbOf("https://media.example/products/seller-a/0b1c.webp")).toBe("https://media.example/products/seller-a/0b1c.thumb.webp")
  })

  it("leaves originals, thumbs, pasted URLs and empties alone", () => {
    expect(thumbOf("https://api.example/media/products/seller-a/0b1c.jpg")).toBe("https://api.example/media/products/seller-a/0b1c.jpg")
    expect(thumbOf("https://api.example/media/products/seller-a/0b1c.thumb.webp")).toBe("https://api.example/media/products/seller-a/0b1c.thumb.webp")
    expect(thumbOf("https://cdn.example.com/shoe.webp")).toBe("https://cdn.example.com/shoe.webp")
    expect(thumbOf(null)).toBeNull()
  })
})
