/**
 * Blueprint Phase 2 — search vocabulary application (Doc 03).
 *
 * Only APPROVED aliases reach these functions; the repository filters by
 * status. Seller spellings stay local until reviewed (alias governance).
 */

export type SearchAliasLike = {
  term: string
  target: string
  type: "synonym" | "redirect"
}

/** Collapse whitespace; keep original casing for display. */
export function normalizeQuery(q: string): string {
  return q.replace(/\s+/g, " ").trim()
}

export type AliasApplication =
  | { kind: "none" }
  | { kind: "synonym"; query: string; aliasTerm: string }
  | { kind: "redirect"; target: string; aliasTerm: string }

/**
 * Exact-match alias application on the normalized, lowercased query.
 * Synonyms rewrite the query (provenance kept in `aliasTerm`);
 * redirects send the buyer to a canonical target (category slug, product id).
 */
export function applyAliases(
  query: string,
  aliases: SearchAliasLike[],
): AliasApplication {
  const key = normalizeQuery(query).toLowerCase()
  if (!key) return { kind: "none" }
  const hit = aliases.find((a) => a.term.trim().toLowerCase() === key)
  if (!hit) return { kind: "none" }
  if (hit.type === "redirect") return { kind: "redirect", target: hit.target, aliasTerm: hit.term }
  return { kind: "synonym", query: hit.target, aliasTerm: hit.term }
}

/** Tokens for substring matching (lowercased, deduped, min length 2). */
export function queryTokens(query: string): string[] {
  const out: string[] = []
  for (const t of normalizeQuery(query).toLowerCase().split(" ")) {
    if (t.length >= 2 && !out.includes(t)) out.push(t)
  }
  return out
}
