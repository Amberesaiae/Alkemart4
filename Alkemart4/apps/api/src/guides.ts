import { guides } from "@alkemart/db"
import { asc, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

/**
 * Blueprint Phase 6E — editorial guides. Drafts schedule like everything
 * else; serving resolves live catalog queries per section so buying advice
 * cannot go stale. Revisions bump on every mutation for the refresh rota.
 */

export class GuideValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "GuideValidationError"
  }
}

export type GuidePick = {
  label?: string | null
  categoryHandle?: string | null
  query?: string | null
  limit?: number | null
}

export type GuideSection = {
  heading: string
  body: string
  picks: GuidePick[]
}

export type GuideDto = {
  slug: string
  title: string
  excerpt: string
  author: string
  status: "draft" | "published"
  revision: number
  sections: GuideSection[]
  relatedGuides: string[]
  refreshAfter: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface GuideStore {
  listGuides(status?: "draft" | "published"): Promise<GuideDto[]>
  getGuide(slug: string): Promise<GuideDto | null>
  createGuide(input: {
    slug: string
    title: string
    excerpt: string
    author: string
  }): Promise<GuideDto>
  updateGuide(slug: string, patch: {
    title?: string
    excerpt?: string
    author?: string
    sections?: GuideSection[]
    relatedGuides?: string[]
    refreshAfter?: string | null
  }): Promise<GuideDto | null>
  publishGuide(slug: string): Promise<GuideDto | null>
  unpublishGuide(slug: string): Promise<GuideDto | null>
  deleteGuide(slug: string): Promise<boolean>
}

function slugify(input: string): string {
  const slug = input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  if (!slug) throw new GuideValidationError("slug required")
  if (slug.length > 80) throw new GuideValidationError("slug must be 80 characters or fewer")
  return slug
}

function cleanText(v: string | null | undefined): string | null {
  const t = v?.trim()
  return t ? t : null
}

function readSections(raw: unknown): GuideSection[] {
  if (!Array.isArray(raw)) throw new GuideValidationError("sections must be a list")
  if (raw.length > 20) throw new GuideValidationError("at most 20 sections per guide")
  return raw.map((item, i) => {
    if (!item || typeof item !== "object") throw new GuideValidationError(`section ${i + 1} is malformed`)
    const s = item as Record<string, unknown>
    const heading = typeof s.heading === "string" ? s.heading.trim() : ""
    const body = typeof s.body === "string" ? s.body.trim() : ""
    if (!heading) throw new GuideValidationError(`section ${i + 1} needs a heading`)
    if (!body) throw new GuideValidationError(`section ${i + 1} needs a body`)
    if (heading.length > 140) throw new GuideValidationError(`section ${i + 1} heading too long`)
    if (body.length > 5000) throw new GuideValidationError(`section ${i + 1} body too long`)
    const picksRaw = Array.isArray(s.picks) ? s.picks : []
    if (picksRaw.length > 3) throw new GuideValidationError(`section ${i + 1} allows at most 3 picks`)
    const picks: GuidePick[] = picksRaw.map((p, j) => {
      if (!p || typeof p !== "object") throw new GuideValidationError(`section ${i + 1} pick ${j + 1} is malformed`)
      const pick = p as Record<string, unknown>
      const categoryHandle = typeof pick.categoryHandle === "string" ? pick.categoryHandle.trim() || null : null
      const query = typeof pick.query === "string" ? pick.query.trim() || null : null
      if (!categoryHandle && !query) {
        throw new GuideValidationError(`section ${i + 1} pick ${j + 1} needs a category or query`)
      }
      const limit =
        typeof pick.limit === "number" && Number.isInteger(pick.limit) && pick.limit >= 1 && pick.limit <= 8
          ? pick.limit
          : 4
      return {
        label: typeof pick.label === "string" ? pick.label.trim() || null : null,
        categoryHandle,
        query,
        limit,
      }
    })
    return { heading, body, picks }
  })
}

function readRelated(raw: unknown): string[] {
  if (!Array.isArray(raw)) throw new GuideValidationError("relatedGuides must be a list")
  if (raw.length > 8) throw new GuideValidationError("at most 8 related guides")
  return raw.map((s) => {
    if (typeof s !== "string" || !s.trim()) throw new GuideValidationError("related guide slugs must be non-empty")
    return slugify(s)
  })
}

function parseMoment(raw: string | null | undefined, field: string): Date | null {
  if (raw == null || raw === "") return null
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) throw new GuideValidationError(`${field} is not a valid date`)
  return d
}

function toDto(row: typeof guides.$inferSelect): GuideDto {
  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    author: row.author,
    status: row.status,
    revision: row.revision,
    sections: readSections(row.sections),
    relatedGuides: Array.isArray(row.relatedGuides) ? (row.relatedGuides as string[]) : [],
    refreshAfter: row.refreshAfter ? row.refreshAfter.toISOString() : null,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    createdAt: row.createdAt ? row.createdAt.toISOString() : new Date(0).toISOString(),
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : new Date(0).toISOString(),
  }
}

type StoredGuide = {
  slug: string
  title: string
  excerpt: string
  author: string
  status: "draft" | "published"
  revision: number
  sections: GuideSection[]
  relatedGuides: string[]
  refreshAfter: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

function storedToDto(g: StoredGuide): GuideDto {
  return { ...g, sections: g.sections.map((s) => ({ ...s, picks: s.picks.map((p) => ({ ...p })) })) }
}

export class InMemoryGuideStore implements GuideStore {
  private readonly rows = new Map<string, StoredGuide>()

  async listGuides(status?: "draft" | "published"): Promise<GuideDto[]> {
    return [...this.rows.values()]
      .filter((g) => !status || g.status === status)
      .sort((a, b) => a.title.localeCompare(b.title))
      .map(storedToDto)
  }

  async getGuide(slug: string): Promise<GuideDto | null> {
    const row = this.rows.get(slug)
    return row ? storedToDto(row) : null
  }

  async createGuide(input: {
    slug: string
    title: string
    excerpt: string
    author: string
  }): Promise<GuideDto> {
    const slug = slugify(input.slug)
    if (this.rows.has(slug)) throw new GuideValidationError("slug already used")
    const title = input.title?.trim()
    const excerpt = input.excerpt?.trim()
    const author = input.author?.trim()
    if (!title) throw new GuideValidationError("title required")
    if (title.length > 140) throw new GuideValidationError("title must be 140 characters or fewer")
    if (!excerpt) throw new GuideValidationError("excerpt required")
    if (excerpt.length > 300) throw new GuideValidationError("excerpt must be 300 characters or fewer")
    if (!author) throw new GuideValidationError("author required")
    const now = new Date().toISOString()
    const row: StoredGuide = {
      slug,
      title,
      excerpt,
      author,
      status: "draft",
      revision: 1,
      sections: [],
      relatedGuides: [],
      refreshAfter: null,
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
    }
    this.rows.set(slug, row)
    return storedToDto(row)
  }

  async updateGuide(slug: string, patch: {
    title?: string
    excerpt?: string
    author?: string
    sections?: GuideSection[]
    relatedGuides?: string[]
    refreshAfter?: string | null
  }): Promise<GuideDto | null> {
    const row = this.rows.get(slug)
    if (!row) return null
    if (patch.title !== undefined) {
      const title = patch.title.trim()
      if (!title) throw new GuideValidationError("title required")
      if (title.length > 140) throw new GuideValidationError("title must be 140 characters or fewer")
      row.title = title
    }
    if (patch.excerpt !== undefined) {
      const excerpt = patch.excerpt.trim()
      if (!excerpt) throw new GuideValidationError("excerpt required")
      if (excerpt.length > 300) throw new GuideValidationError("excerpt must be 300 characters or fewer")
      row.excerpt = excerpt
    }
    if (patch.author !== undefined) {
      const author = patch.author.trim()
      if (!author) throw new GuideValidationError("author required")
      row.author = author
    }
    if (patch.sections !== undefined) row.sections = readSections(patch.sections)
    if (patch.relatedGuides !== undefined) {
      const related = readRelated(patch.relatedGuides).filter((s) => s !== slug)
      for (const s of related) {
        if (!this.rows.has(s)) throw new GuideValidationError(`unknown related guide: ${s}`)
      }
      row.relatedGuides = related
    }
    if (patch.refreshAfter !== undefined) {
      row.refreshAfter = parseMoment(patch.refreshAfter, "refreshAfter")?.toISOString() ?? null
    }
    row.revision += 1
    row.updatedAt = new Date().toISOString()
    return storedToDto(row)
  }

  async publishGuide(slug: string): Promise<GuideDto | null> {
    const row = this.rows.get(slug)
    if (!row) return null
    if (row.sections.length === 0) {
      throw new GuideValidationError("a guide needs at least one section before publishing")
    }
    row.status = "published"
    row.publishedAt = new Date().toISOString()
    row.revision += 1
    row.updatedAt = row.publishedAt
    return storedToDto(row)
  }

  async unpublishGuide(slug: string): Promise<GuideDto | null> {
    const row = this.rows.get(slug)
    if (!row) return null
    row.status = "draft"
    row.revision += 1
    row.updatedAt = new Date().toISOString()
    return storedToDto(row)
  }

  async deleteGuide(slug: string): Promise<boolean> {
    const row = this.rows.get(slug)
    if (!row) return false
    if (row.status !== "draft") {
      throw new GuideValidationError("only drafts delete; unpublish a live guide first")
    }
    // Break inbound links honestly: related lists pointing here drop it.
    for (const other of this.rows.values()) {
      other.relatedGuides = other.relatedGuides.filter((s) => s !== slug)
    }
    this.rows.delete(slug)
    return true
  }
}

export class PostgresGuideStore implements GuideStore {
  constructor(private readonly db: PostgresJsDatabase) {}

  async listGuides(status?: "draft" | "published"): Promise<GuideDto[]> {
    const rows = await this.db
      .select()
      .from(guides)
      .where(status ? eq(guides.status, status) : undefined)
      .orderBy(asc(guides.title))
    return rows.map(toDto)
  }

  async getGuide(slug: string): Promise<GuideDto | null> {
    const [row] = await this.db.select().from(guides).where(eq(guides.slug, slug)).limit(1)
    return row ? toDto(row) : null
  }

  async createGuide(input: {
    slug: string
    title: string
    excerpt: string
    author: string
  }): Promise<GuideDto> {
    const slug = slugify(input.slug)
    const title = input.title?.trim()
    const excerpt = input.excerpt?.trim()
    const author = input.author?.trim()
    if (!title) throw new GuideValidationError("title required")
    if (title.length > 140) throw new GuideValidationError("title must be 140 characters or fewer")
    if (!excerpt) throw new GuideValidationError("excerpt required")
    if (excerpt.length > 300) throw new GuideValidationError("excerpt must be 300 characters or fewer")
    if (!author) throw new GuideValidationError("author required")
    const now = new Date()
    const [taken] = await this.db.select({ slug: guides.slug }).from(guides).where(eq(guides.slug, slug)).limit(1)
    if (taken) throw new GuideValidationError("slug already used")
    let row: typeof guides.$inferSelect | undefined
    try {
      ;[row] = await this.db
        .insert(guides)
        .values({ slug, title, excerpt, author, status: "draft", revision: 1, createdAt: now, updatedAt: now })
        .returning()
    } catch (err) {
      // Concurrent double-create: the unique slug row already landed.
      const [existing] = await this.db.select().from(guides).where(eq(guides.slug, slug)).limit(1)
      if (existing) throw new GuideValidationError("slug already used")
      throw new Error("guide store unavailable - POST /admin/migrate/blueprint-phase6", { cause: err })
    }
    if (!row) throw new Error("guide insert failed")
    return toDto(row)
  }

  async updateGuide(slug: string, patch: {
    title?: string
    excerpt?: string
    author?: string
    sections?: GuideSection[]
    relatedGuides?: string[]
    refreshAfter?: string | null
  }): Promise<GuideDto | null> {
    const [row] = await this.db.select().from(guides).where(eq(guides.slug, slug)).limit(1)
    if (!row) return null
    const set: Partial<typeof guides.$inferInsert> = {}
    if (patch.title !== undefined) {
      const title = patch.title.trim()
      if (!title) throw new GuideValidationError("title required")
      if (title.length > 140) throw new GuideValidationError("title must be 140 characters or fewer")
      set.title = title
    }
    if (patch.excerpt !== undefined) {
      const excerpt = patch.excerpt.trim()
      if (!excerpt) throw new GuideValidationError("excerpt required")
      if (excerpt.length > 300) throw new GuideValidationError("excerpt must be 300 characters or fewer")
      set.excerpt = excerpt
    }
    if (patch.author !== undefined) {
      const author = patch.author.trim()
      if (!author) throw new GuideValidationError("author required")
      set.author = author
    }
    if (patch.sections !== undefined) set.sections = readSections(patch.sections)
    if (patch.relatedGuides !== undefined) {
      const related = readRelated(patch.relatedGuides).filter((s) => s !== slug)
      for (const s of related) {
        const [known] = await this.db.select({ slug: guides.slug }).from(guides).where(eq(guides.slug, s)).limit(1)
        if (!known) throw new GuideValidationError(`unknown related guide: ${s}`)
      }
      set.relatedGuides = related
    }
    if (patch.refreshAfter !== undefined) set.refreshAfter = parseMoment(patch.refreshAfter, "refreshAfter")
    set.revision = row.revision + 1
    set.updatedAt = new Date()
    const [fresh] = await this.db.update(guides).set(set).where(eq(guides.slug, slug)).returning()
    if (!fresh) return null
    return toDto(fresh)
  }

  async publishGuide(slug: string): Promise<GuideDto | null> {
    const [row] = await this.db.select().from(guides).where(eq(guides.slug, slug)).limit(1)
    if (!row) return null
    if (readSections(row.sections).length === 0) {
      throw new GuideValidationError("a guide needs at least one section before publishing")
    }
    const now = new Date()
    const [fresh] = await this.db
      .update(guides)
      .set({ status: "published", publishedAt: now, revision: row.revision + 1, updatedAt: now })
      .where(eq(guides.slug, slug))
      .returning()
    if (!fresh) return null
    return toDto(fresh)
  }

  async unpublishGuide(slug: string): Promise<GuideDto | null> {
    const [row] = await this.db.select().from(guides).where(eq(guides.slug, slug)).limit(1)
    if (!row) return null
    const now = new Date()
    const [fresh] = await this.db
      .update(guides)
      .set({ status: "draft", revision: row.revision + 1, updatedAt: now })
      .where(eq(guides.slug, slug))
      .returning()
    if (!fresh) return null
    return toDto(fresh)
  }

  async deleteGuide(slug: string): Promise<boolean> {
    const [row] = await this.db.select().from(guides).where(eq(guides.slug, slug)).limit(1)
    if (!row) return false
    if (row.status !== "draft") {
      throw new GuideValidationError("only drafts delete; unpublish a live guide first")
    }
    await this.db.transaction(async (tx) => {
      const others = await tx.select().from(guides)
      for (const other of others) {
        if (Array.isArray(other.relatedGuides) && (other.relatedGuides as string[]).includes(slug)) {
          await tx
            .update(guides)
            .set({ relatedGuides: (other.relatedGuides as string[]).filter((s) => s !== slug) })
            .where(eq(guides.slug, other.slug))
        }
      }
      await tx.delete(guides).where(eq(guides.slug, slug))
    })
    return true
  }
}
