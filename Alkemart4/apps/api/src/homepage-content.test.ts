import { describe, expect, it } from "vitest"
import { categoryRatioOf, categoryTilesOf, currentDaypart, isRuleSource, migrateSections, visibleSections } from "@alkemart/shared/homepage"
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

  it("filters per-section visibility windows", () => {
    const now = new Date("2030-06-15T12:00:00.000Z")
    expect(visibleSections([
      { id: "a", type: "promo_band", title: "Live", theme: "gold" },
      { id: "b", type: "promo_band", title: "Hidden", theme: "gold", visible: false },
      { id: "c", type: "promo_band", title: "Future", theme: "gold", startsAt: "2030-07-01T00:00:00.000Z" },
      { id: "d", type: "promo_band", title: "Expired", theme: "gold", endsAt: "2030-06-01T00:00:00.000Z" },
    ], now).map((section) => section.id)).toEqual(["a"])
  })

  it("forward-migrates pre-banner category sections", async () => {
    const legacy = {
      id: "cats",
      type: "category_grid" as const,
      title: "Shop by category",
      columns: 4 as const,
      variant: "mosaic" as const,
      categoryIds: ["pets", "food", "beauty", "phones"],
      tiles: [],
    }
    const [migrated] = migrateSections([legacy])
    expect(migrated).toMatchObject({ type: "category_grid" })
    if (migrated.type !== "category_grid") throw new Error("expected a category section")
    expect(migrated.categoryIds).toBeUndefined()
    expect(migrated.tiles.map((tile) => [tile.categoryId, tile.slot])).toEqual([
      ["pets", "feature"],
      ["food", "feature"],
      ["beauty", "standard"],
      ["phones", "standard"],
    ])
    expect(categoryRatioOf(migrated)).toBe("landscape")
  })

  it("keeps configured banner tiles over the legacy shape", () => {
    const section = {
      id: "cats",
      type: "category_grid" as const,
      title: "Shop by category",
      columns: 4 as const,
      categoryIds: ["stale"],
      tiles: [{ categoryId: "food", imageUrl: "https://cdn.example/food.jpg", slot: "feature" as const }],
    }
    expect(categoryTilesOf(section).map((tile) => tile.categoryId)).toEqual(["food"])
  })

  it("classifies rule sources separately from curated picks", () => {
    expect(isRuleSource("featured")).toBe(false)
    expect(isRuleSource("manual")).toBe(false)
    expect(isRuleSource("most_ordered")).toBe(true)
    expect(isRuleSource("trending")).toBe(true)
    expect(isRuleSource("daypart")).toBe(true)
    expect(isRuleSource("near_me")).toBe(true)
  })

  it("maps local hour to a coarse Ghana trading daypart", () => {
    expect(currentDaypart(new Date(2030, 5, 15, 5))).toBe("breakfast")
    expect(currentDaypart(new Date(2030, 5, 15, 11))).toBe("lunch")
    expect(currentDaypart(new Date(2030, 5, 15, 16))).toBe("supper")
    expect(currentDaypart(new Date(2030, 5, 15, 22))).toBe("late")
  })

  it("publishes a store rail without rewriting it", async () => {
    const store = new InMemoryHomepageContentStore()
    const initial = await store.getEditor()
    const draft = await store.saveDraft({
      expectedRevision: initial.revision,
      sections: [{ id: "shops", type: "store_rail", title: "Top rated shops", source: "top_rated", limit: 8 }],
    })
    await store.publish({ expectedRevision: draft.revision })
    expect(await store.getPublished()).toMatchObject([{ id: "shops", type: "store_rail", source: "top_rated" }])
  })

  it("rejects stale editor revisions", async () => {
    const store = new InMemoryHomepageContentStore()
    const initial = await store.getEditor()
    await store.saveDraft({ expectedRevision: initial.revision, sections: [] })
    await expect(store.saveDraft({ expectedRevision: initial.revision, sections: [] })).rejects.toBeInstanceOf(ContentRevisionConflict)
  })
})
