import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../auth-repository"
import { InMemoryCatalogRepository } from "../catalog-repository"
import { demoCatalog } from "../demo-seed"
import { InMemoryHomepageContentStore } from "../homepage-content"
import { createApp } from "../index"
import { signSessionJwt } from "./jwt"
import { PREVIEW_TTL_MS, checkPreviewToken, mintPreviewToken } from "./preview-token"
import { resetRateLimits } from "../middleware/security"
resetRateLimits()

const SECRET = "test-jwt-secret-that-is-at-least-32-chars-long"

describe("preview tokens", () => {
  it("are purpose-bound and expire", async () => {
    const t = await mintPreviewToken(SECRET, "homepage-draft", 1_000)
    expect(await checkPreviewToken(SECRET, "homepage-draft", t, 2_000)).toBe(true)
    expect(await checkPreviewToken(SECRET, "something-else", t, 2_000)).toBe(false)
    expect(await checkPreviewToken(SECRET, "homepage-draft", t, 1_000 + PREVIEW_TTL_MS + 1)).toBe(false)
    expect(await checkPreviewToken("another-secret-another-secret-xx", "homepage-draft", t, 2_000)).toBe(false)
    expect(await checkPreviewToken(SECRET, "homepage-draft", t.replace(/.$/, (c) => (c === "0" ? "1" : "0")), 2_000)).toBe(false)
  })

  it("show the draft homepage only with a valid admin-minted token", async () => {
    const homepage = new InMemoryHomepageContentStore()
    const doc = await homepage.getEditor()
    await homepage.saveDraft({ expectedRevision: doc.revision, sections: [{ id: "draft-hero", type: "promo_hero", title: "Draft only", theme: "gold" }] })
    await homepage.publish({ expectedRevision: (await homepage.getEditor()).revision })
    const d2 = await homepage.getEditor()
    await homepage.saveDraft({ expectedRevision: d2.revision, sections: [{ id: "next-hero", type: "promo_hero", title: "Next week", theme: "black" }] })
    const authRepo = new InMemoryAuthRepository()
    const app = createApp({ repo: new InMemoryCatalogRepository(demoCatalog()), authRepo, homepageStore: homepage, jwtSecret: SECRET })
    const admin = await signSessionJwt({ userId: "admin-1", role: "admin" }, SECRET)
    const minted = await app.request("/admin/homepage/preview-token", { method: "POST", headers: { Authorization: `Bearer ${admin}` } })
    expect(minted.status).toBe(200)
    const { token } = (await minted.json()) as { token: string }

    const live = (await (await app.request("/store/homepage")).json()) as { sections: { id: string }[] }
    expect(live.sections.map((s) => s.id)).toEqual(["draft-hero"])
    const draft = (await (await app.request(`/store/homepage?preview=${token}`)).json()) as { sections: { id: string }[]; preview?: boolean }
    expect(draft.preview).toBe(true)
    expect(draft.sections.map((s) => s.id)).toEqual(["next-hero"])
    const forged = (await (await app.request("/store/homepage?preview=pv1.99999999999999.deadbeef")).json()) as { sections: { id: string }[]; preview?: boolean }
    expect(forged.preview).toBeUndefined()
  })
})

describe("homepage editor contract", () => {
  it("accepts the default homepage as-is (every shared source is savable)", async () => {
    const { DEFAULT_HOMEPAGE_SECTIONS } = await import("@alkemart/shared/homepage")
    const homepage = new InMemoryHomepageContentStore()
    const app = createApp({ repo: new InMemoryCatalogRepository(demoCatalog()), authRepo: new InMemoryAuthRepository(), homepageStore: homepage, jwtSecret: SECRET })
    const admin = await signSessionJwt({ userId: "admin-1", role: "admin" }, SECRET)
    const { revision } = await homepage.getEditor()
    const res = await app.request("/admin/homepage/draft", {
      method: "PUT",
      headers: { Authorization: `Bearer ${admin}`, "Content-Type": "application/json" },
      body: JSON.stringify({ revision, sections: DEFAULT_HOMEPAGE_SECTIONS }),
    })
    expect(res.status, await res.clone().text()).toBe(200)
  })
})
