/**
 * Listing review policy — who decides what, given the facts.
 *
 * Inputs: seller-facing rule findings (checkListing), advisory moderation
 * flags (banned phrases, price outliers, duplicates) and, optionally, an AI
 * opinion. Output: one decision with reasons written to the seller.
 *
 * Principles:
 *  - Rules are cheap and certain: a blocking finding goes straight back to
 *    the seller with the exact fix, whatever the mode.
 *  - Scam/counterfeit signals always reach a human (never auto-approved,
 *    never auto-rejected by AI alone).
 *  - AI may auto-APPROVE only in "auto" mode, only a rule-clean, unflagged
 *    listing, and only at or above the confidence bar. Anything else goes to
 *    the admin queue with the AI's opinion attached as advice.
 *  - "trust" (the default — trust by default, exceptions to a person): a
 *    rule-clean, unflagged listing goes live at once without waiting for AI
 *    or a person. Any flag, or an AI that doubts it, sends it to the queue.
 *  - Every outcome is overridable by an admin and logged.
 */
import type { ListingFinding } from "./listing-checks"

export type ReviewMode = "trust" | "manual" | "assist" | "auto"
export type ReviewDecision = "approve" | "request_changes" | "reject" | "escalate"
export type ReviewReason = { code: string; message: string; field?: string }

export type ModerationFlagLike = { rule: string; message: string }

export type AiOpinion = {
  verdict: "approve" | "changes" | "escalate"
  confidence: number
  reasons: ReviewReason[]
  model: string
}

export type ListingReviewOutcome = {
  decision: ReviewDecision
  reviewer: "system" | "ai"
  reasons: ReviewReason[]
  /** AI advice kept for the admin when a human still has to decide. */
  advice?: AiOpinion | null
}

export const AUTO_APPROVE_CONFIDENCE = 0.85

/** Flags that must always reach a person. */
const HUMAN_FLAGS = new Set(["banned-words"])

export function decideListing(input: {
  mode: ReviewMode
  findings: ListingFinding[]
  flags: ModerationFlagLike[]
  ai?: AiOpinion | null
}): ListingReviewOutcome {
  const blocks = input.findings.filter((f) => f.severity === "block")
  if (blocks.length) {
    return {
      decision: "request_changes",
      reviewer: "system",
      reasons: blocks.map((f) => ({ code: f.code, message: f.message, field: f.field })),
    }
  }
  const humanFlags = input.flags.filter((f) => HUMAN_FLAGS.has(f.rule))
  if (humanFlags.length) {
    return {
      decision: "escalate",
      reviewer: "system",
      reasons: humanFlags.map((f) => ({ code: f.rule, message: f.message })),
      advice: input.ai ?? null,
    }
  }
  if (input.mode === "trust") {
    const ai = input.ai
    if (ai?.verdict === "changes" && ai.confidence >= AUTO_APPROVE_CONFIDENCE && ai.reasons.length) {
      return { decision: "request_changes", reviewer: "ai", reasons: ai.reasons, advice: ai }
    }
    if (input.flags.length === 0 && (!ai || ai.verdict === "approve")) {
      return { decision: "approve", reviewer: "system", reasons: [], advice: ai ?? null }
    }
  }
  if (input.mode === "auto" && input.ai) {
    const ai = input.ai
    if (ai.verdict === "approve" && ai.confidence >= AUTO_APPROVE_CONFIDENCE && input.flags.length === 0) {
      return { decision: "approve", reviewer: "ai", reasons: [], advice: ai }
    }
    if (ai.verdict === "changes" && ai.confidence >= AUTO_APPROVE_CONFIDENCE && ai.reasons.length) {
      // Clear, specific quality asks go back to the seller; admins can override.
      return { decision: "request_changes", reviewer: "ai", reasons: ai.reasons, advice: ai }
    }
  }
  return {
    decision: "escalate",
    reviewer: input.ai ? "ai" : "system",
    reasons: input.flags.map((f) => ({ code: f.rule, message: f.message })),
    advice: input.ai ?? null,
  }
}

/** Parse untrusted model output into an opinion, or null when unusable. */
export function parseAiOpinion(raw: unknown, model: string): AiOpinion | null {
  let v = raw
  if (typeof v === "string") {
    const m = v.match(/\{[\s\S]*\}/)
    if (!m) return null
    try {
      v = JSON.parse(m[0])
    } catch {
      return null
    }
  }
  if (!v || typeof v !== "object") return null
  const o = v as { verdict?: unknown; confidence?: unknown; reasons?: unknown }
  if (o.verdict !== "approve" && o.verdict !== "changes" && o.verdict !== "escalate") return null
  const confidence = typeof o.confidence === "number" && o.confidence >= 0 && o.confidence <= 1 ? o.confidence : 0
  const reasons = Array.isArray(o.reasons)
    ? o.reasons
        .filter((r): r is { code?: unknown; message?: unknown } => Boolean(r) && typeof r === "object")
        .map((r) => ({
          code: typeof r.code === "string" ? r.code.slice(0, 40).replace(/[^a-z0-9_]/gi, "_").toLowerCase() : "ai_note",
          message: typeof r.message === "string" ? r.message.slice(0, 300) : "",
        }))
        .filter((r) => r.message)
        .slice(0, 5)
    : []
  return { verdict: o.verdict, confidence, reasons, model }
}
