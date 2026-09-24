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
): FacetGroup[] {
  const isSelected = (code: string) => (selected[code]?.length ?? 0) > 0
  return groups
    .filter((g) => isSelected(g.code) || Object.keys(g.values).length > 1)
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
