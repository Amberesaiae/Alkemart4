import { contentPages } from "@alkemart/db"
import {
  DEFAULT_HOMEPAGE_SECTIONS,
  type HomeSection,
  type HomepageDocument,
  migrateSections,
} from "@alkemart/shared/homepage"
import { and, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

type StoredPage = {
  revision: number
  draftSections: HomeSection[]
  publishedSections: HomeSection[]
  scheduledSections: HomeSection[] | null
  publishAt: Date | null
  unpublishAt: Date | null
  updatedAt: Date
}

export class ContentRevisionConflict extends Error {
  constructor() {
    super("homepage changed in another session; reload before saving")
    this.name = "ContentRevisionConflict"
  }
}

export interface HomepageContentStore {
  getEditor(): Promise<HomepageDocument>
  getPublished(now?: Date): Promise<HomeSection[]>
  saveDraft(input: { sections: HomeSection[]; expectedRevision: number }): Promise<HomepageDocument>
  publish(input: { expectedRevision: number; unpublishAt?: Date | null }): Promise<HomepageDocument>
  schedule(input: { expectedRevision: number; publishAt: Date; unpublishAt?: Date | null }): Promise<HomepageDocument>
}

function editorDocument(row: StoredPage): HomepageDocument {
  return {
    key: "homepage",
    revision: row.revision,
    sections: migrateSections(row.draftSections),
    status: row.scheduledSections && row.publishAt ? "scheduled" : row.publishedSections.length ? "published" : "draft",
    publishAt: row.publishAt?.toISOString() ?? null,
    unpublishAt: row.unpublishAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  }
}

function initialPage(): StoredPage {
  return {
    revision: 1,
    draftSections: DEFAULT_HOMEPAGE_SECTIONS,
    publishedSections: [],
    scheduledSections: null,
    publishAt: null,
    unpublishAt: null,
    updatedAt: new Date(),
  }
}

export class PostgresHomepageContentStore implements HomepageContentStore {
  constructor(private readonly db: PostgresJsDatabase) {}

  private async read(): Promise<StoredPage> {
    const [row] = await this.db.select().from(contentPages).where(eq(contentPages.key, "homepage")).limit(1)
    if (row) return row as StoredPage
    const seed = initialPage()
    await this.db.insert(contentPages).values({
      key: "homepage",
      ...seed,
    }).onConflictDoNothing()
    const [created] = await this.db.select().from(contentPages).where(eq(contentPages.key, "homepage")).limit(1)
    return created as StoredPage
  }

  async getEditor() {
    return editorDocument(await this.read())
  }

  async getPublished(now = new Date()) {
    const row = await this.read()
    if (row.unpublishAt && row.unpublishAt <= now) return []
    if (row.scheduledSections && row.publishAt && row.publishAt <= now) return migrateSections(row.scheduledSections)
    return migrateSections(row.publishedSections)
  }

  private async update(expectedRevision: number, values: Partial<StoredPage>) {
    const [updated] = await this.db
      .update(contentPages)
      .set({ ...values, revision: expectedRevision + 1, updatedAt: new Date() })
      .where(and(eq(contentPages.key, "homepage"), eq(contentPages.revision, expectedRevision)))
      .returning()
    if (!updated) throw new ContentRevisionConflict()
    return editorDocument(updated as StoredPage)
  }

  saveDraft({ sections, expectedRevision }: { sections: HomeSection[]; expectedRevision: number }) {
    return this.update(expectedRevision, { draftSections: migrateSections(sections) })
  }

  async publish({ expectedRevision, unpublishAt = null }: { expectedRevision: number; unpublishAt?: Date | null }) {
    const row = await this.read()
    if (row.revision !== expectedRevision) throw new ContentRevisionConflict()
    return this.update(expectedRevision, {
      publishedSections: row.draftSections,
      scheduledSections: null,
      publishAt: null,
      unpublishAt,
    })
  }

  async schedule({ expectedRevision, publishAt, unpublishAt = null }: { expectedRevision: number; publishAt: Date; unpublishAt?: Date | null }) {
    const row = await this.read()
    if (row.revision !== expectedRevision) throw new ContentRevisionConflict()
    return this.update(expectedRevision, {
      scheduledSections: row.draftSections,
      publishAt,
      unpublishAt,
    })
  }
}

export class InMemoryHomepageContentStore implements HomepageContentStore {
  private row = initialPage()

  async getEditor() { return editorDocument(this.row) }

  async getPublished(now = new Date()) {
    if (this.row.unpublishAt && this.row.unpublishAt <= now) return []
    if (this.row.scheduledSections && this.row.publishAt && this.row.publishAt <= now) return migrateSections(this.row.scheduledSections)
    return migrateSections(this.row.publishedSections)
  }

  private mutate(expectedRevision: number, values: Partial<StoredPage>) {
    if (this.row.revision !== expectedRevision) throw new ContentRevisionConflict()
    this.row = { ...this.row, ...values, revision: this.row.revision + 1, updatedAt: new Date() }
    return editorDocument(this.row)
  }

  async saveDraft({ sections, expectedRevision }: { sections: HomeSection[]; expectedRevision: number }) {
    return this.mutate(expectedRevision, { draftSections: migrateSections(sections) })
  }

  async publish({ expectedRevision, unpublishAt = null }: { expectedRevision: number; unpublishAt?: Date | null }) {
    return this.mutate(expectedRevision, {
      publishedSections: this.row.draftSections,
      scheduledSections: null,
      publishAt: null,
      unpublishAt,
    })
  }

  async schedule({ expectedRevision, publishAt, unpublishAt = null }: { expectedRevision: number; publishAt: Date; unpublishAt?: Date | null }) {
    return this.mutate(expectedRevision, {
      scheduledSections: this.row.draftSections,
      publishAt,
      unpublishAt,
    })
  }
}
