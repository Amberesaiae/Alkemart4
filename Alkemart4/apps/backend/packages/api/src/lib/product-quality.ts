/**
 * Product quality score (0–100) — advisory only, never blocks.
 * Score shown in dashboard as guidance. Propose gate passes always.
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
  price_ghs?: number | null
  status?: string | null
}

const MIN_TITLE_BLOCK = 8
const MIN_DESC = 40

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

export function scoreProductQuality(input: ProductQualityInput): QualityResult {
  const title = str(input.title)
  const description = str(input.description)
  const imgs = imageCount(input)
  const cats = categoryCount(input)
  const price = input.price_ghs

  const checks: QualityCheck[] = []

  let titlePts = 0
  if (title.length >= 80) titlePts = 25
  else if (title.length >= 12) titlePts = 20
  else if (title.length >= MIN_TITLE_BLOCK) titlePts = 10
  else titlePts = 0
  checks.push({
    id: "title",
    ok: title.length >= MIN_TITLE_BLOCK,
    weight: 25,
    message:
      title.length >= MIN_TITLE_BLOCK
        ? "Title looks good"
        : "Title too short — aim for 8+ characters",
  })

  let descPts = 0
  if (description.length >= 200) descPts = 25
  else if (description.length >= MIN_DESC) descPts = 18
  else if (description.length >= 15) descPts = 10
  else descPts = 0
  checks.push({
    id: "description",
    ok: description.length >= MIN_DESC,
    weight: 25,
    message:
      description.length >= MIN_DESC
        ? "Description length is good"
        : "Add more detail — aim for 40+ characters",
  })

  let imgPts = 0
  if (imgs >= 4) imgPts = 30
  else if (imgs >= 2) imgPts = 22
  else if (imgs >= 1) imgPts = 12
  else imgPts = 0
  checks.push({
    id: "images",
    ok: imgs >= 1,
    weight: 30,
    message: imgs >= 1 ? "Has at least one photo" : "Add at least one photo",
  })

  let catPts = 0
  if (cats >= 2) catPts = 10
  else if (cats >= 1) catPts = 6
  else catPts = 0
  checks.push({
    id: "categories",
    ok: cats >= 1,
    weight: 10,
    message: cats >= 1 ? "Has category" : "Select a category",
  })

  let pricePts = 0
  if (price != null && price >= 0.5 && price <= 500_000) pricePts = 10
  checks.push({
    id: "price",
    ok: price != null && price >= 0.5,
    weight: 10,
    message:
      price != null && price >= 0.5
        ? "Price set"
        : "Set a valid price (min GH₵0.50)",
  })

  const score = Math.min(
    checks.reduce((sum, c) => sum + (c.ok ? c.weight : 0), 0),
    100,
  )

  const blocking = checks.filter((c) => !c.ok).map((c) => c.id)

  return {
    score,
    band: bandFor(score),
    blocking,
    checks,
    computed_at: new Date().toISOString(),
  }
}

export function qualityMetadataSnapshot(q: QualityResult): Record<string, unknown> {
  return {
    score: q.score,
    band: q.band,
    checks: q.checks,
    blocking: q.blocking,
    computed_at: q.computed_at,
  }
}
