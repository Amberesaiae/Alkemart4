import { describe, expect, it } from "vitest"
import { ContentRevisionConflict, InMemoryHomepageContentStore } from "./homepage-content"

describe("homepage content", () => {
  it("keeps drafts private until publish", async () => {
    const store = new InMemoryHomepageContentStore()
    const initial = await store.getEditor()
    await store.saveDraft({ expectedRevision: initial.revision, sections: [{ id: "hero", type: "promo_hero", title: "Market day", theme: "gold" }] })
    expect(await store.getPublished()).toEqual([])
    const draft = await store.getEditor()
    await store.publish({ expectedRevision: draft.revision })
    expect(await store.getPublished()).toMatchObject([{ id: "hero", type: "promo_hero" }])
  })

  it("publishes a scheduled snapshot only after its start time", async () => {
    const store = new InMemoryHomepageContentStore()
    const initial = await store.getEditor()
    const draft = await store.saveDraft({ expectedRevision: initial.revision, sections: [{ id: "season", type: "promo_grid", columns: 2, theme: "white", tiles: [{ id: "one", title: "Seasonal", href: "/categories/all" }] }] })
    const starts = new Date("2030-12-01T00:00:00.000Z")
    await store.schedule({ expectedRevision: draft.revision, publishAt: starts })
    expect(await store.getPublished(new Date("2030-11-30T23:59:59.000Z"))).toEqual([])
    expect(await store.getPublished(starts)).toHaveLength(1)
  })

  it("rejects stale editor revisions", async () => {
    const store = new InMemoryHomepageContentStore()
    const initial = await store.getEditor()
    await store.saveDraft({ expectedRevision: initial.revision, sections: [] })
    await expect(store.saveDraft({ expectedRevision: initial.revision, sections: [] })).rejects.toBeInstanceOf(ContentRevisionConflict)
  })
})
