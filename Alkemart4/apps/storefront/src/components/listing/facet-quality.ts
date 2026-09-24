/**
 * How useful is a facet, right now, for this result set?
 *
 * Alphabetical facet order is arbitrary: a facet where one value holds 95% of
 * the results teaches the buyer almost nothing, while one that splits the set
 * evenly halves their work. Normalised entropy measures exactly that — 0 when
 * every product shares one value, 1 when they are spread evenly.
 *
 * Facets with a single value score 0 and are worth hiding entirely: a filter
 * that cannot change the result set is a control that does nothing.
 */
export function facetSplitQuality(values: Record<string, number>): number {
  const counts = Object.values(values).filter((n) => n > 0)
  if (counts.length < 2) return 0
  const total = counts.reduce((a, b) => a + b, 0)
  if (total === 0) return 0
  const entropy = -counts.reduce((acc, n) => {
    const p = n / total
    return acc + p * Math.log2(p)
  }, 0)
  // Normalise by the best possible split for this many values, so a 2-value
  // and a 40-value facet are comparable.
  return entropy / Math.log2(counts.length)
}

export type FacetGroup = {
  code: string
  label: string
  values: Record<string, number>
}

/**
 * Highest-signal facets first; single-value facets dropped.
 *
 * A facet the buyer has already used stays pinned at the top regardless of
 * score — collapsing or reordering a control someone just touched is
 * disorienting, and its score drops precisely *because* they narrowed with it.
 */
export function orderFacets(
  groups: readonly FacetGroup[],
  selected: Record<string, string[]> = {},
  totalResults?: number,
): FacetGroup[] {
  const isSelected = (code: string) => (selected[code]?.length ?? 0) > 0
  /**
   * A facet is dead only when picking it cannot change the result set — that
   * is, one value that every result already shares.
   *
   * The earlier rule was "more than one value", which is wrong whenever a
   * facet describes a subset: with three results and one tagged Leather,
   * selecting Leather narrows 3 -> 1, which is exactly what a filter is for.
   * On a small catalogue that rule hid every facet and made the whole panel
   * look broken.
   */
  const canNarrow = (g: FacetGroup) => {
    const values = Object.values(g.values).filter((n) => n > 0)
    if (values.length === 0) return false
    if (values.length > 1) return true
    return typeof totalResults === "number" ? values[0] < totalResults : false
  }
  return groups
    .filter((g) => isSelected(g.code) || canNarrow(g))
    .map((g) => ({ group: g, score: facetSplitQuality(g.values) }))
    .sort((a, b) => {
      const aSel = isSelected(a.group.code)
      const bSel = isSelected(b.group.code)
      if (aSel !== bSel) return aSel ? -1 : 1
      if (b.score !== a.score) return b.score - a.score
      return a.group.label.localeCompare(b.group.label)
    })
    .map((x) => x.group)
}

/** Zero-count values are unreachable; showing them invites a dead end. */
export function prunedValues(
  values: Record<string, number>,
  selected: readonly string[] = [],
): [string, number][] {
  return Object.entries(values)
    .filter(([value, count]) => count > 0 || selected.includes(value))
    .sort(([, a], [, b]) => b - a)
}
