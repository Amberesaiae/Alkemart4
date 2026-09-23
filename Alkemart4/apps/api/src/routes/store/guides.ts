import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import type { ProductCardDto } from "@alkemart/domain"
import type { AppEnv } from "../../context"

/**
 * Phase 6E public reads — published guides only, with picks resolved to
 * live catalog cards at serve time. Prices, stock, and sellers always come
 * from the catalog, never from prose.
 */
export const storeGuides = new Hono<AppEnv>()
  .get("/", async (c) => {
    const items = await c.get("guides").listGuides("published")
    return c.json({
      items: items.map((g) => ({
        slug: g.slug,
        title: g.title,
        excerpt: g.excerpt,
        author: g.author,
        publishedAt: g.publishedAt,
        refreshAfter: g.refreshAfter,
      })),
    })
  })
  .get("/:slug", async (c) => {
    const slug = c.req.param("slug")
    const guide = await c.get("guides").getGuide(slug)
    if (!guide || guide.status !== "published") {
      throw new HTTPException(404, { message: "guide not found" })
    }
    const repo = c.get("repo")
    const sections: {
      heading: string
      body: string
      picks: { label: string | null; cards: ProductCardDto[] }[]
    }[] = []
    for (const section of guide.sections) {
      const picks: { label: string | null; cards: ProductCardDto[] }[] = []
      for (const pick of section.picks) {
        if (!pick.categoryHandle && !pick.query) continue
        const found = await repo
          .listCatalog({
            category: pick.categoryHandle ?? undefined,
            q: pick.query ?? undefined,
            limit: Math.min(8, Math.max(1, pick.limit ?? 4)),
            offset: 0,
          })
          .catch(() => ({ items: [], total: 0 }))
        if (found.items.length === 0) continue
        picks.push({ label: pick.label ?? null, cards: found.items })
      }
      sections.push({ heading: section.heading, body: section.body, picks })
    }
    const related = (
      await Promise.all(guide.relatedGuides.map((s) => c.get("guides").getGuide(s).catch(() => null)))
    ).filter((g) => g && g.status === "published")
    return c.json({
      guide: {
        slug: guide.slug,
        title: guide.title,
        excerpt: guide.excerpt,
        author: guide.author,
        publishedAt: guide.publishedAt,
        refreshAfter: guide.refreshAfter,
        revision: guide.revision,
      },
      sections,
      related: related.map((g) => ({
        slug: g!.slug,
        title: g!.title,
        excerpt: g!.excerpt,
      })),
    })
  })
