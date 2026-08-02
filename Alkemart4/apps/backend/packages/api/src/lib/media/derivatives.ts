/**
 * Image derivative helpers (async job path).
 * Uses sharp when installed; pure helpers are unit-tested without native deps.
 */

export const THUMB_MAX_EDGE = 400
export const WEB_MAX_EDGE = 1600

export type DerivativePlan = {
  kind: "thumb" | "web"
  maxEdge: number
  format: "webp"
  quality: number
}

export function planDerivatives(): DerivativePlan[] {
  return [
    { kind: "thumb", maxEdge: THUMB_MAX_EDGE, format: "webp", quality: 80 },
    { kind: "web", maxEdge: WEB_MAX_EDGE, format: "webp", quality: 82 },
  ]
}

/** Decide resize edge preserving aspect (longest side). */
export function targetDimensions(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number; needsResize: boolean } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: maxEdge, height: maxEdge, needsResize: true }
  }
  const longest = Math.max(width, height)
  if (longest <= maxEdge) {
    return { width, height, needsResize: false }
  }
  const scale = maxEdge / longest
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    needsResize: true,
  }
}

export type DerivativeResult = {
  kind: "thumb" | "web"
  buffer: Buffer
  width: number
  height: number
  contentType: "image/webp"
  filenameSuffix: string
}

export type ProcessImageOk = {
  ok: true
  derivatives: DerivativeResult[]
  source: { width: number; height: number }
}
export type ProcessImageErr = { ok: false; error: string; sharpMissing?: boolean }

/**
 * Generate webp thumb + web derivatives.
 * Returns sharpMissing when the optional dependency is not installed.
 */
type SharpFactory = (input: Buffer, opts?: { failOn?: string }) => {
  metadata: () => Promise<{ width?: number; height?: number }>
  rotate: () => SharpPipeline
  resize: (opts: Record<string, unknown>) => SharpPipeline
  webp: (opts: { quality: number }) => SharpPipeline
}

type SharpPipeline = {
  rotate: () => SharpPipeline
  resize: (opts: Record<string, unknown>) => SharpPipeline
  webp: (opts: { quality: number }) => SharpPipeline
  toBuffer: () => Promise<Buffer>
  metadata: () => Promise<{ width?: number; height?: number }>
}

export async function processImageBuffer(
  input: Buffer,
): Promise<ProcessImageOk | ProcessImageErr> {
  let sharp: SharpFactory
  try {
    // Optional native dependency — `bun add sharp` for production derivatives
    const mod = await import("sharp")
    sharp = (mod.default || mod) as unknown as SharpFactory
  } catch {
    return {
      ok: false,
      error: "sharp is not installed; skip derivatives until dependency is added",
      sharpMissing: true,
    }
  }

  try {
    const meta = await sharp(input, { failOn: "none" }).metadata()
    const srcW = meta.width || 0
    const srcH = meta.height || 0
    if (!srcW || !srcH) {
      return { ok: false, error: "Could not read image dimensions" }
    }

    const derivatives: DerivativeResult[] = []
    for (const plan of planDerivatives()) {
      const dim = targetDimensions(srcW, srcH, plan.maxEdge)
      let img: SharpPipeline = sharp(input, { failOn: "none" }).rotate()
      if (dim.needsResize) {
        img = img.resize({
          width: dim.width,
          height: dim.height,
          fit: "inside",
          withoutEnlargement: true,
        })
      }
      const buffer = await img.webp({ quality: plan.quality }).toBuffer()
      const outMeta = await sharp(buffer, { failOn: "none" }).metadata()
      derivatives.push({
        kind: plan.kind,
        buffer,
        width: outMeta.width || dim.width,
        height: outMeta.height || dim.height,
        contentType: "image/webp",
        filenameSuffix: `-${plan.kind}.webp`,
      })
    }

    return {
      ok: true,
      derivatives,
      source: { width: srcW, height: srcH },
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Image processing failed",
    }
  }
}

/** Metadata stamp for product.metadata.alkemart.media */
export type ProductMediaMeta = {
  derivatives_status?: "pending" | "ready" | "skipped" | "failed"
  derivatives_at?: string
  derivatives_error?: string
  source_width?: number
  source_height?: number
  thumb_url?: string
  web_url?: string
}

export function markMediaPending(
  existing?: Record<string, unknown> | null,
): Record<string, unknown> {
  const alk =
    existing && typeof existing.alkemart === "object" && existing.alkemart
      ? { ...(existing.alkemart as Record<string, unknown>) }
      : {}
  const media: ProductMediaMeta = {
    ...((alk.media as ProductMediaMeta) || {}),
    derivatives_status: "pending",
  }
  return {
    ...existing,
    alkemart: {
      ...alk,
      media,
    },
  }
}

/**
 * Per-image media metadata for seller logo / banner.
 * Stored under seller.metadata.alkemart.media.{ logo | banner }.
 */
export type SellerImageMeta = {
  derivatives_status?: "pending" | "ready" | "skipped" | "failed"
  derivatives_at?: string
  derivatives_error?: string
  source_width?: number
  source_height?: number
  thumb_url?: string
  web_url?: string
}

export type SellerMediaMeta = {
  logo?: SellerImageMeta
  banner?: SellerImageMeta
}

const SELLER_IMAGE_KEYS: (keyof SellerMediaMeta)[] = ["logo", "banner"]

/**
 * Mark one seller image (logo|banner) derivatives as pending, merging with
 * any existing media meta. Pure helper (unit-tested).
 */
export function markSellerMediaPending(
  existing?: Record<string, unknown> | null,
  which: "logo" | "banner" = "logo",
): Record<string, unknown> {
  const alk =
    existing && typeof existing.alkemart === "object" && existing.alkemart
      ? { ...(existing.alkemart as Record<string, unknown>) }
      : {}
  const media = (alk.media as SellerMediaMeta) || {}
  return {
    ...existing,
    alkemart: {
      ...alk,
      media: {
        ...media,
        [which]: {
          ...(media[which] || {}),
          derivatives_status: "pending",
          derivatives_error: undefined,
        },
      },
    },
  }
}

/** Read the stored derivative URLs for a seller image, if present. */
export function readSellerImageMeta(
  sellerMeta?: Record<string, unknown> | null,
): { logo: SellerImageMeta; banner: SellerImageMeta } {
  const alk = sellerMeta?.alkemart
  const media = (alk && typeof alk === "object" && (alk as Record<string, unknown>).media
    ? (alk as Record<string, unknown>).media as Partial<SellerMediaMeta>
    : {}) || {}
  return {
    logo: (media.logo || {}) as SellerImageMeta,
    banner: (media.banner || {}) as SellerImageMeta,
  }
}

/** For type guards / future iteration over seller image keys. */
export function sellerImageKeys(): (keyof SellerMediaMeta)[] {
  return [...SELLER_IMAGE_KEYS]
}

/** Read the flat derivative URLs produced by processProductImages. */
export function readProductMediaMeta(
  productMeta?: Record<string, unknown> | null,
): { thumbUrl: string | null; webUrl: string | null } {
  const alk = productMeta?.alkemart
  const media =
    alk && typeof alk === "object" && (alk as Record<string, unknown>).media
      ? (alk as Record<string, unknown>).media as ProductMediaMeta
      : {}
  const thumb = typeof media.thumb_url === "string" && media.thumb_url ? media.thumb_url : null
  const web = typeof media.web_url === "string" && media.web_url ? media.web_url : null
  return { thumbUrl: thumb, webUrl: web }
}
