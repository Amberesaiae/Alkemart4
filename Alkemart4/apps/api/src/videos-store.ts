import { listingAssistUsage, productVideos } from "@alkemart/db"
import type { VideoPlatform } from "@alkemart/domain"
import { and, desc, eq, inArray, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

export type VideoStatus = "pending" | "approved" | "rejected"
export type VideoRow = {
  id: string
  productId: string
  sellerId: string
  platform: VideoPlatform
  videoId: string
  url: string
  status: VideoStatus
  featured: boolean
  rejectReason: string | null
  createdAt: Date
  decidedAt: Date | null
}

export class VideoExistsError extends Error {
  constructor() {
    super("That video is already on this listing.")
    this.name = "VideoExistsError"
  }
}

/** Product video links (0047) and the monthly photo-reading allowance counter. */
export interface VideosStore {
  addVideo(v: Pick<VideoRow, "productId" | "sellerId" | "platform" | "videoId" | "url">): Promise<VideoRow>
  getVideo(id: string): Promise<VideoRow | null>
  listVideos(f: { productIds?: string[]; sellerId?: string; statuses?: VideoStatus[]; featured?: boolean }): Promise<VideoRow[]>
  removeVideo(id: string, sellerId: string): Promise<boolean>
  decideVideo(id: string, patch: { status?: VideoStatus; featured?: boolean; rejectReason?: string | null }): Promise<VideoRow | null>
  /** Adds one read if it stays within `limit`; returns the count after, or null when the allowance is used up. */
  takePhotoRead(sellerId: string, period: string, limit: number): Promise<number | null>
  photoReadsUsed(sellerId: string, period: string): Promise<number>
}

export class InMemoryVideosStore implements VideosStore {
  private videos = new Map<string, VideoRow>()
  private usage = new Map<string, number>()
  async addVideo(v: Pick<VideoRow, "productId" | "sellerId" | "platform" | "videoId" | "url">) {
    if ([...this.videos.values()].some((x) => x.productId === v.productId && x.platform === v.platform && x.videoId === v.videoId)) throw new VideoExistsError()
    const row: VideoRow = { ...v, id: crypto.randomUUID(), status: "pending", featured: false, rejectReason: null, createdAt: new Date(), decidedAt: null }
    this.videos.set(row.id, row)
    return { ...row }
  }
  async getVideo(id: string) {
    const v = this.videos.get(id)
    return v ? { ...v } : null
  }
  async listVideos(f: { productIds?: string[]; sellerId?: string; statuses?: VideoStatus[]; featured?: boolean }) {
    const ids = f.productIds ? new Set(f.productIds) : null
    return [...this.videos.values()]
      .filter((v) => (!ids || ids.has(v.productId)) && (!f.sellerId || v.sellerId === f.sellerId) && (!f.statuses || f.statuses.includes(v.status)) && (f.featured === undefined || v.featured === f.featured))
      .sort((a, b) => +b.createdAt - +a.createdAt)
      .map((v) => ({ ...v }))
  }
  async removeVideo(id: string, sellerId: string) {
    const v = this.videos.get(id)
    if (!v || v.sellerId !== sellerId) return false
    this.videos.delete(id)
    return true
  }
  async decideVideo(id: string, patch: { status?: VideoStatus; featured?: boolean; rejectReason?: string | null }) {
    const v = this.videos.get(id)
    if (!v) return null
    if (patch.status) {
      v.status = patch.status
      v.decidedAt = new Date()
      if (patch.status !== "approved") v.featured = false
    }
    if (patch.featured !== undefined) v.featured = patch.featured && v.status === "approved"
    if (patch.rejectReason !== undefined) v.rejectReason = patch.rejectReason
    return { ...v }
  }
  async takePhotoRead(sellerId: string, period: string, limit: number) {
    const k = `${sellerId}|${period}`
    const n = this.usage.get(k) ?? 0
    if (n >= limit) return null
    this.usage.set(k, n + 1)
    return n + 1
  }
  async photoReadsUsed(sellerId: string, period: string) {
    return this.usage.get(`${sellerId}|${period}`) ?? 0
  }
}

export class PostgresVideosStore implements VideosStore {
  constructor(private readonly db: PostgresJsDatabase) {}
  async addVideo(v: Pick<VideoRow, "productId" | "sellerId" | "platform" | "videoId" | "url">) {
    const rows = await this.db
      .insert(productVideos)
      .values({ ...v, id: crypto.randomUUID() })
      .onConflictDoNothing()
      .returning()
    if (!rows[0]) throw new VideoExistsError()
    return rows[0] as VideoRow
  }
  async getVideo(id: string) {
    const [r] = await this.db.select().from(productVideos).where(eq(productVideos.id, id)).limit(1)
    return (r as VideoRow | undefined) ?? null
  }
  async listVideos(f: { productIds?: string[]; sellerId?: string; statuses?: VideoStatus[]; featured?: boolean }) {
    const where = [
      f.productIds ? (f.productIds.length ? inArray(productVideos.productId, f.productIds) : sql`false`) : undefined,
      f.sellerId ? eq(productVideos.sellerId, f.sellerId) : undefined,
      f.statuses ? (f.statuses.length ? inArray(productVideos.status, f.statuses) : sql`false`) : undefined,
      f.featured !== undefined ? eq(productVideos.featured, f.featured) : undefined,
    ].filter(Boolean)
    return (await this.db.select().from(productVideos).where(where.length ? and(...where) : undefined).orderBy(desc(productVideos.createdAt)).limit(300)) as VideoRow[]
  }
  async removeVideo(id: string, sellerId: string) {
    const rows = await this.db.delete(productVideos).where(and(eq(productVideos.id, id), eq(productVideos.sellerId, sellerId))).returning({ id: productVideos.id })
    return rows.length > 0
  }
  async decideVideo(id: string, patch: { status?: VideoStatus; featured?: boolean; rejectReason?: string | null }) {
    const set: Record<string, unknown> = {}
    if (patch.status) {
      set.status = patch.status
      set.decidedAt = new Date()
      if (patch.status !== "approved") set.featured = false
    }
    if (patch.featured !== undefined) set.featured = sql`${patch.featured} AND ${productVideos.status} = 'approved'`
    if (patch.rejectReason !== undefined) set.rejectReason = patch.rejectReason
    const [r] = await this.db.update(productVideos).set(set).where(eq(productVideos.id, id)).returning()
    return (r as VideoRow | undefined) ?? null
  }
  async takePhotoRead(sellerId: string, period: string, limit: number) {
    // One statement: insert-or-increment only while under the limit.
    const rows = await this.db
      .insert(listingAssistUsage)
      .values({ sellerId, period, photoReads: 1 })
      .onConflictDoUpdate({
        target: [listingAssistUsage.sellerId, listingAssistUsage.period],
        set: { photoReads: sql`${listingAssistUsage.photoReads} + 1` },
        setWhere: sql`${listingAssistUsage.photoReads} < ${limit}`,
      })
      .returning({ n: listingAssistUsage.photoReads })
    return rows[0]?.n ?? null
  }
  async photoReadsUsed(sellerId: string, period: string) {
    const [r] = await this.db
      .select({ n: listingAssistUsage.photoReads })
      .from(listingAssistUsage)
      .where(and(eq(listingAssistUsage.sellerId, sellerId), eq(listingAssistUsage.period, period)))
      .limit(1)
    return r?.n ?? 0
  }
}
