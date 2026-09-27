import { checkListing, decideListing, parseAiOpinion, type AiOpinion, type ListingReviewOutcome, type ReviewMode } from "@alkemart/domain"
import type { CatalogRepository, VendorProductDto } from "../catalog-repository"
import type { WorkersAiLike } from "../env"
import type { ListingReviewStore } from "../listing-reviews"
import { moderateProduct } from "./moderate"

export const REVIEW_MODEL = "@cf/meta/llama-3.1-8b-instruct"
const AI_TIMEOUT_MS = 8_000

/**
 * The AI reviewer: a second pair of eyes on what rules can't judge —
 * whether the item is allowed, whether title/photos/category agree, and
 * whether claims look misleading. Output is untrusted and validated
 * (parseAiOpinion); any failure or timeout means "no opinion", never a
 * decision.
 */
export async function aiReviewListing(
  ai: WorkersAiLike,
  input: { title: string; description: string | null; category: string; prices: string[]; condition: string | null },
): Promise<AiOpinion | null> {
  const prompt = [
    "You review marketplace listings for an African multi-seller marketplace before they go live.",
    "Decide one of: approve | changes | escalate.",
    '- "escalate" if the item may be prohibited or dangerous (weapons, drugs, alcohol/tobacco to minors, counterfeit or replica brands, adult content, live animals, medicines needing prescription, financial scams, stolen goods) or anything you are unsure about.',
    '- "changes" if the listing is allowed but misleading or unclear (title does not match the category, obviously wrong price, vague title). Give short, kind, specific fixes addressed to the seller.',
    '- "approve" if it is a normal, clear, allowed listing.',
    'Reply with JSON only: {"verdict":"approve|changes|escalate","confidence":0..1,"reasons":[{"code":"snake_case","message":"to the seller"}]}',
    "",
    `Title: ${input.title}`,
    `Category: ${input.category}`,
    `Condition: ${input.condition ?? "unspecified"}`,
    `Prices (minor units): ${input.prices.join(", ")}`,
    `Description: ${(input.description ?? "").slice(0, 1500)}`,
  ].join("\n")
  try {
    const run = ai.run(REVIEW_MODEL, {
      messages: [
        { role: "system", content: "You are a careful trust-and-safety reviewer. You reply with JSON only." },
        { role: "user", content: prompt },
      ],
      max_tokens: 400,
    })
    const result = await Promise.race([run, new Promise<null>((r) => setTimeout(() => r(null), AI_TIMEOUT_MS))])
    if (!result) return null
    return parseAiOpinion(typeof result === "string" ? result : (result.response ?? ""), REVIEW_MODEL)
  } catch {
    return null
  }
}

/**
 * Run the review for a freshly submitted listing and apply the outcome.
 * Idempotent in effect: it only acts on a product that is still "proposed".
 * Never throws — a review hiccup leaves the listing queued for a human.
 */
export async function reviewSubmittedListing(deps: {
  repo: CatalogRepository
  reviews: ListingReviewStore
  ai?: WorkersAiLike
  product: VendorProductDto
  categoryName: string
  missingRequiredSpecs?: string[]
}): Promise<ListingReviewOutcome | null> {
  const { repo, reviews, product } = deps
  try {
    const combos = product.variants.length ? product.variants : [{ offer: product.offer }]
    const active = combos.filter((c) => c.offer.active)
    const findings = checkListing({
      title: product.product.title,
      description: product.product.description,
      imageCount: product.images.length || (product.product.imageUrl ? 1 : 0),
      prices: active.map((c) => Number(c.offer.pricePesewas)),
      categoryId: product.product.primaryCategoryId,
      missingRequiredSpecs: deps.missingRequiredSpecs,
    })
    const flags = await repo
      .listAdminProductsWithFlags("proposed")
      .then((xs) => xs.find((x) => x.id === product.product.id)?.flags ?? [])
      .catch(() => [])
    const mode: ReviewMode = await reviews.getReviewMode().catch(() => "manual" as const)
    const blocked = findings.some((f) => f.severity === "block")
    const ai =
      !blocked && mode !== "manual" && deps.ai
        ? await aiReviewListing(deps.ai, {
            title: product.product.title,
            description: product.product.description,
            category: deps.categoryName,
            prices: active.map((c) => c.offer.pricePesewas),
            condition: product.offer.condition,
          })
        : null
    const outcome = decideListing({ mode, findings, flags, ai })
    await reviews.record({
      productId: product.product.id,
      decision: outcome.decision,
      reviewer: outcome.reviewer,
      reasons: outcome.reasons,
      model: outcome.advice?.model ?? null,
      confidence: outcome.advice?.confidence ?? null,
      note: outcome.advice && outcome.decision === "escalate" ? `AI advice: ${outcome.advice.verdict}` : null,
    })
    if (outcome.decision === "approve") await moderateProduct(repo, product.product.id, "approve")
    if (outcome.decision === "request_changes") await moderateProduct(repo, product.product.id, "request_changes")
    return outcome
  } catch (err) {
    console.error(JSON.stringify({ job: "listing-review", productId: product.product.id, error: err instanceof Error ? err.message : String(err) }))
    return null
  }
}
