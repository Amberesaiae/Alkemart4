import type { AdminProductDto } from "../catalog-repository"

/**
 * Identity fingerprint for clustering offers onto one comparable product.
 *
 * Google Shopping clusters on GTIN first. Ghana is a GTIN-poor market —
 * unbarcoded goods, second-hand imports, market-stall stock — so Google's
 * *fallback* (brand + model + attribute similarity) has to be our primary
 * path. Without clustering there is no "3 sellers, one product", and without
 * that there is no price comparison.
 *
 * Scoped within product type on purpose: comparing a laptop to a laptop is
 * meaningful, comparing within "Electronics" is not.
 *
 * Proposals are evidence, never merges. `product_match_candidates` rows go to
 * an admin queue; nothing here changes a product.
 */

export type FingerprintInput = {
  id: string
  productType?: string | null
  brand?: string | null
  model?: string | null
  gtin?: string | null
  title: string
}

/** Token-preserving: keeps word boundaries, for title comparison. */
const norm = (v: string | null | undefined): string =>
  (v ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

/**
 * Boundary-free, for identity keys. Model numbers are written every possible
 * way — "T480", "T-480", "T 480" — and they are the same model. Keeping the
 * space would split one product into three.
 */
const normKey = (v: string | null | undefined): string =>
  (v ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "")

/** Strong key: same type, brand and model. Null when identity is too thin. */
export function fingerprintOf(p: FingerprintInput): string | null {
  const gtin = normKey(p.gtin)
  if (gtin) return `gtin:${gtin}`
  const type = normKey(p.productType)
  const brand = normKey(p.brand)
  const model = normKey(p.model)
  if (!type || !brand || !model) return null
  return `tbm:${type}|${brand}|${model}`
}

/** Jaccard overlap of title tokens — the weak signal, for review only. */
export function titleSimilarity(a: string, b: string): number {
  const ta = new Set(norm(a).split(" ").filter((t) => t.length > 2))
  const tb = new Set(norm(b).split(" ").filter((t) => t.length > 2))
  if (ta.size === 0 || tb.size === 0) return 0
  let shared = 0
  for (const t of ta) if (tb.has(t)) shared += 1
  return shared / (ta.size + tb.size - shared)
}

export type MatchProposal = {
  candidateId: string
  source: "rules" | "similarity"
  evidence: Record<string, unknown>
}

const SIMILARITY_FLOOR = 0.6

/**
 * Candidates for one product against the catalogue.
 *
 * Only ever proposes within the same product type, and never proposes the
 * product against itself. A thin-identity product (no type/brand/model) yields
 * nothing rather than a guess — `seller_specific` is the honest resting state.
 */
export function proposalsFor(
  subject: FingerprintInput,
  catalogue: readonly FingerprintInput[],
  limit = 5,
): MatchProposal[] {
  const subjectPrint = fingerprintOf(subject)
  const subjectType = norm(subject.productType)
  const out: MatchProposal[] = []

  for (const other of catalogue) {
    if (other.id === subject.id) continue
    if (subjectPrint && fingerprintOf(other) === subjectPrint) {
      out.push({
        candidateId: other.id,
        source: "rules",
        evidence: { fingerprint: subjectPrint },
      })
      continue
    }
    // Similarity is only meaningful inside a type; across types it is noise.
    if (!subjectType || norm(other.productType) !== subjectType) continue
    const score = titleSimilarity(subject.title, other.title)
    if (score >= SIMILARITY_FLOOR) {
      out.push({
        candidateId: other.id,
        source: "similarity",
        evidence: { titleSimilarity: Number(score.toFixed(3)), productType: subjectType },
      })
    }
  }

  // Rule matches outrank similarity; strongest similarity first.
  return out
    .sort((a, b) => {
      if (a.source !== b.source) return a.source === "rules" ? -1 : 1
      return (
        ((b.evidence.titleSimilarity as number) ?? 1) -
        ((a.evidence.titleSimilarity as number) ?? 1)
      )
    })
    .slice(0, limit)
}

export type { AdminProductDto }
