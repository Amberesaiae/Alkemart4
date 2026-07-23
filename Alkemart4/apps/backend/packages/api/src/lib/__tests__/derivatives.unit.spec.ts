import {
  markMediaPending,
  planDerivatives,
  targetDimensions,
} from "../media/derivatives"

describe("targetDimensions", () => {
  it("does not upscale small images", () => {
    const d = targetDimensions(200, 100, 400)
    expect(d.needsResize).toBe(false)
    expect(d.width).toBe(200)
    expect(d.height).toBe(100)
  })

  it("scales down longest edge", () => {
    const d = targetDimensions(2000, 1000, 400)
    expect(d.needsResize).toBe(true)
    expect(d.width).toBe(400)
    expect(d.height).toBe(200)
  })
})

describe("planDerivatives", () => {
  it("returns thumb and web webp plans", () => {
    const plans = planDerivatives()
    expect(plans.map((p) => p.kind)).toEqual(["thumb", "web"])
    expect(plans.every((p) => p.format === "webp")).toBe(true)
  })
})

describe("markMediaPending", () => {
  it("sets derivatives_status pending under metadata.alkemart.media", () => {
    const next = markMediaPending({ foo: 1 })
    expect(next.foo).toBe(1)
    const alk = next.alkemart as { media: { derivatives_status: string } }
    expect(alk.media.derivatives_status).toBe("pending")
  })
})
