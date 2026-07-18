/**
 * Product quality score (0–100) + blocking rules for propose.
 * Snapshot may be stored on product.metadata.alkemart.quality.
 *
 * ADR: docs/architecture/2026-07-18-seller-onboarding-product-quality-pipeline.md
 */

export type QualityCheck = {
  id: string
  ok: boolean
  weight: number
  message: string
}

export type QualityResult = {
  score: number
  band: "poor" | "fair" | "good" | "excellent"
  blocking: string[]
  checks: QualityCheck[]
  computed_at: string
}

export type ProductQualityInput = {
  title?: string | null
  description?: string | null
  thumbnail?: string | null
  images?: Array<{ url?: string | null } | string> | null
  category_ids?: string[] | null
  categories?: Array<{ id?: string } | string> | null
  /** Offer amount in major GHS units (runbook: 45 = GH₵45). Optional at propose. */
  price_ghs?: number | null
  status?: string | null
}

const MIN_TITLE_SCORE = 12
const MIN_TITLE_BLOCK = 8
const MIN_DESC = 40
const MIN_SCORE_PROPOSE = 40
const PRICE_MIN = 0.5
const PRICE_MAX = 500_000

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v != null ? String(v).trim() : ""
}

function imageCount(input: ProductQualityInput): number {
  let n = 0
  if (str(input.thumbnail)) n += 1
  const imgs = input.images
  if (Array.isArray(imgs)) {
    for (const img of imgs) {
      if (typeof img === "string" && img.trim()) n += 1
      else if (img && typeof img === "object" && str(img.url)) n += 1
    }
  }
  return n
}

function categoryCount(input: ProductQualityInput): number {
  if (Array.isArray(input.category_ids) && input.category_ids.length) {
    return input.category_ids.filter(Boolean).length
  }
  if (Array.isArray(input.categories)) {
    return input.categories.filter((c) =>
      typeof c === "string" ? c : Boolean(c && typeof c === "object" && c.id),
    ).length
  }
  return 0
}

function bandFor(score: number): QualityResult["band"] {
  if (score >= 85) return "excellent"
  if (score >= 70) return "good"
  if (score >= 40) return "fair"
  return "poor"
}

/**
 * Score weights (sum 100 when all good):
 * title 25, description 25, images 30, category 10, price sanity 10
 */
export function scoreProductQuality(input: ProductQualityInput): QualityResult {
  const title = str(input.title)
  const description = str(input.description)
  const imgs = imageCount(input)
  const cats = categoryCount(input)
  const price = input.price_ghs

  const checks: QualityCheck[] = []

  // Title
  let titlePts = 0
  if (title.length >= 80) titlePts = 25
  else if (title.length >= MIN_TITLE_SCORE) titlePts = 20
  else if (title.length >= MIN_TITLE_BLOCK) titlePts = 10
  else titlePts = 0
  checks.push({
    id: "title",
    ok: title.length >= MIN_TITLE_SCORE,
    weight: 25,
    message:
      title.length >= MIN_TITLE_SCORE
        ? "Title length OK"
        : `Title too short (min ${MIN_TITLE_SCORE} chars for full score; ${MIN_TITLE_BLOCK} to propose)`,
  })

  // Description
  let descPts = 0
  if (description.length >= 200) descPts = 25
  else if (description.length >= MIN_DESC) descPts = 18
  else if (description.length > 0) descPts = 8
  checks.push({
    id: "description",
    ok: description.length >= MIN_DESC,
    weight: 25,
    message:
      description.length >= MIN_DESC
        ? "Description OK"
        : `Add a clearer description (min ~${MIN_DESC} characters)`,
  })

  // Images
  let imgPts = 0
  if (imgs >= 3) imgPts = 30
  else if (imgs === 2) imgPts = 22
  else if (imgs === 1) imgPts = 14
  checks.push({
    id: "images",
    ok: imgs >= 1,
    weight: 30,
    message: imgs >= 1 ? `${imgs} image(s)` : "Add at least one product image",
  })

  // Category
  const requireCategory =
    (process.env.ALKEMART_REQUIRE_CATEGORY_ON_PROPOSE ?? "false").toLowerCase() ===
    "true"
  const catPts = cats > 0 ? 10 : 0
  checks.push({
    id: "category",
    ok: cats > 0 || !requireCategory,
    weight: 10,
    message:
      cats > 0
        ? "Category set"
        : requireCategory
          ? "Category required before propose"
          : "Category optional (recommended)",
  })

  // Price (optional at propose — only scores when provided)
  let pricePts = 10
  let priceOk = true
  if (price != null && Number.isFinite(price)) {
    priceOk = price >= PRICE_MIN && price <= PRICE_MAX
    pricePts = priceOk ? 10 : 0
  }
  checks.push({
    id: "price",
    ok: priceOk,
    weight: 10,
    message: priceOk
      ? price == null
        ? "Price checked at offer time"
        : "Price within expected GHS range"
      : `Price must be between ${PRICE_MIN} and ${PRICE_MAX} GHS (major units)`,
  })

  const score = Math.min(
    100,
    Math.max(0, titlePts + descPts + imgPts + catPts + pricePts),
  )

  const blocking: string[] = []
  if (title.length < MIN_TITLE_BLOCK) {
    blocking.push(`Title must be at least ${MIN_TITLE_BLOCK} characters`)
  }
  if (imgs < 1) {
    blocking.push("At least one product image is required")
  }
  if (score < MIN_SCORE_PROPOSE) {
    blocking.push(
      `Quality score ${score} is below minimum ${MIN_SCORE_PROPOSE} for propose`,
    )
  }
  if (requireCategory && cats < 1) {
    blocking.push("Category is required before propose")
  }
  if (!priceOk) {
    blocking.push("Offer price is outside the allowed GHS range")
  }

  return {
    score,
    band: bandFor(score),
    blocking,
    checks,
    computed_at: new Date().toISOString(),
  }
}

export function assertCanPropose(input: ProductQualityInput): QualityResult {
  const result = scoreProductQuality(input)
  if (result.blocking.length) {
    throw new Error(
      `Product quality gate: ${result.blocking.join("; ")} (score ${result.score})`,
    )
  }
  return result
}

/** Build metadata snapshot for product.metadata.alkemart.quality */
export function qualityMetadataSnapshot(result: QualityResult): Record<string, unknown> {
  return {
    score: result.score,
    band: result.band,
    computed_at: result.computed_at,
    checks: result.checks.map((c) => ({
      id: c.id,
      ok: c.ok,
      message: c.message,
    })),
  }
}
