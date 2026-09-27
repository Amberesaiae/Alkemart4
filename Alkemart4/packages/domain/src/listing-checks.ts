/**
 * Listing quality rules — one source for the seller's live hints and the
 * automated review (system checks run before any AI or human looks).
 *
 * Each finding has a stable `code` (for analytics and appeals), a severity
 * and a plain-language message written TO THE SELLER.
 *   - block: can't be approved as is (contact details, no photo, no price)
 *   - fix:   should be fixed; reviewers will ask for it
 *   - tip:   makes the listing sell better; never blocks
 */

export type ListingSeverity = "block" | "fix" | "tip"
export type ListingFinding = { code: string; severity: ListingSeverity; field: string; message: string }

export type ListingInput = {
  title: string
  description?: string | null
  imageCount: number
  /** Minor units per active option (or the single price). */
  prices: number[]
  categoryId?: string | null
  missingRequiredSpecs?: string[]
}

const PHONE = /(\+?\d[\d\s().-]{8,}\d)/
const URL_OR_HANDLE = /(https?:\/\/|www\.|\.com\b|\.gh\b|@[a-z0-9_]{3,}|wa\.me|whatsapp|t\.me\/)/i
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/

export const TITLE_MIN = 10
export const TITLE_MAX = 120

export function checkListing(l: ListingInput): ListingFinding[] {
  const out: ListingFinding[] = []
  const title = l.title.trim()
  const desc = (l.description ?? "").trim()
  const text = `${title}\n${desc}`

  if (PHONE.test(text) || EMAIL.test(text) || URL_OR_HANDLE.test(text)) {
    out.push({
      code: "contact_details",
      severity: "block",
      field: PHONE.test(title) || URL_OR_HANDLE.test(title) || EMAIL.test(title) ? "title" : "description",
      message: "Remove phone numbers, links, emails and social handles. Buyers order through alkemart so they're protected — your contact details are on your shop page.",
    })
  }
  if (l.imageCount < 1) out.push({ code: "no_photo", severity: "block", field: "photos", message: "Add at least one photo of the actual item." })
  if (!l.prices.length || l.prices.some((p) => !Number.isFinite(p) || p <= 0)) {
    out.push({ code: "no_price", severity: "block", field: "price", message: "Every option needs a price above zero." })
  }
  if (!l.categoryId) out.push({ code: "no_category", severity: "block", field: "category", message: "Choose a category so buyers can find it." })
  if (l.missingRequiredSpecs?.length) {
    out.push({
      code: "missing_specs",
      severity: "block",
      field: "specs",
      message: `Fill in: ${l.missingRequiredSpecs.join(", ")}.`,
    })
  }

  if (title.length < TITLE_MIN) {
    out.push({ code: "title_short", severity: "fix", field: "title", message: "Make the name more specific — brand, model, size or colour help buyers find it." })
  } else if (title.length > TITLE_MAX) {
    out.push({ code: "title_long", severity: "fix", field: "title", message: `Keep the name under ${TITLE_MAX} characters. Put extra detail in the description.` })
  }
  const letters = title.replace(/[^A-Za-z]/g, "")
  if (letters.length >= 8 && letters === letters.toUpperCase()) {
    out.push({ code: "title_caps", severity: "fix", field: "title", message: "Avoid ALL CAPITALS — it reads as shouting and ranks lower." })
  }
  if (/(.)\1{4,}|!{2,}|\?{2,}/.test(title)) {
    out.push({ code: "title_noise", severity: "fix", field: "title", message: "Drop repeated characters and extra punctuation from the name." })
  }
  if (/\b(best|cheapest|no\.?\s?1|guaranteed|100%|original)\b/i.test(title)) {
    out.push({ code: "title_claims", severity: "tip", field: "title", message: "Words like “best” or “100% original” don't help — say what it is instead." })
  }

  if (l.imageCount === 1) out.push({ code: "one_photo", severity: "tip", field: "photos", message: "Listings with 3+ photos sell better — show the back, details and packaging." })
  if (desc.length < 40) out.push({ code: "short_description", severity: "tip", field: "description", message: "A couple of lines on condition, size and what's in the box builds trust." })
  if (l.prices.length > 1) {
    const [lo, hi] = [Math.min(...l.prices), Math.max(...l.prices)]
    if (lo > 0 && hi / lo > 20) {
      out.push({ code: "price_spread", severity: "fix", field: "price", message: "Some option prices differ by more than 20×. Check for a typo (an extra zero?)." })
    }
  }
  return out
}

export const blocking = (fs: ListingFinding[]) => fs.filter((f) => f.severity === "block")
