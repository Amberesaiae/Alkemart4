import {
  markMediaPending,
  markSellerMediaPending,
  planDerivatives,
  readProductMediaMeta,
  readSellerImageMeta,
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

describe("markSellerMediaPending", () => {
  it("marks only the requested image as pending", () => {
    const next = markSellerMediaPending({ existing: 1 }, "banner")
    expect(next.existing).toBe(1)
    const alk = next.alkemart as {
      media: { logo?: { derivatives_status: string }; banner?: { derivatives_status: string } }
    }
    expect(alk.media.banner?.derivatives_status).toBe("pending")
    expect(alk.media.logo).toBeUndefined()
  })

  it("preserves an existing sibling image's derived status", () => {
    const seed = markSellerMediaPending({}, "logo")
    // now mark banner pending — logo status must survive
    const next = markSellerMediaPending(seed, "banner")
    const alk = next.alkemart as {
      media: {
        logo?: { derivatives_status: string }
        banner?: { derivatives_status: string }
      }
    }
    expect(alk.media.logo?.derivatives_status).toBe("pending")
    expect(alk.media.banner?.derivatives_status).toBe("pending")
  })

  it("clears prior error when re-marking pending", () => {
    const seed: Record<string, unknown> = {
      alkemart: {
        media: { logo: { derivatives_status: "failed", derivatives_error: "boom" } },
      },
    }
    const next = markSellerMediaPending(seed, "logo")
    const alk = next.alkemart as { media: { logo: { derivatives_status: string; derivatives_error?: string } } }
    expect(alk.media.logo.derivatives_status).toBe("pending")
    expect(alk.media.logo.derivatives_error).toBeUndefined()
  })

  it("treats null existing safely", () => {
    const next = markSellerMediaPending(null, "banner")
    const alk = next.alkemart as { media: { banner?: { derivatives_status: string } } }
    expect(alk.media.banner?.derivatives_status).toBe("pending")
  })
})

describe("readSellerImageMeta", () => {
  it("returns empty metas for nullish", () => {
    const { logo, banner } = readSellerImageMeta(null)
    expect(logo).toEqual({})
    expect(banner).toEqual({})
  })

  it("reads stored derivative urls", () => {
    const { logo, banner } = readSellerImageMeta({
      alkemart: { media: { logo: { thumb_url: "t", web_url: "w" }, banner: { web_url: "bw" } } },
    })
    expect(logo).toEqual({ thumb_url: "t", web_url: "w" })
    expect(banner).toEqual({ web_url: "bw" })
  })
})

describe("readProductMediaMeta", () => {
  it("returns nulls for nullish", () => {
    expect(readProductMediaMeta(null)).toEqual({ thumbUrl: null, webUrl: null })
    expect(readProductMediaMeta(undefined)).toEqual({
      thumbUrl: null,
      webUrl: null,
    })
  })

  it("reads flat thumb_url/web_url", () => {
    const m = readProductMediaMeta({
      alkemart: { media: { thumb_url: "t400", web_url: "w1600" } },
    })
    expect(m).toEqual({ thumbUrl: "t400", webUrl: "w1600" })
  })

  it("treats non-string urls as null", () => {
    const m = readProductMediaMeta({
      alkemart: { media: { thumb_url: 123, web_url: "" } },
    })
    expect(m).toEqual({ thumbUrl: null, webUrl: null })
  })
})
