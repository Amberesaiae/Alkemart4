export type CategoryNode = {
  id: string
  handle: string
  name: string
  parentId: string | null
  children: CategoryNode[]
}

export type TaxonomyStatus = "proposed" | "active" | "deprecated"

export type TaxonomyNodeRow = {
  id: string
  handle: string
  name: string
  parentId: string | null
  rank: number
  status: TaxonomyStatus
  isBrowseable: boolean
  isAssignable: boolean
  isNavVisible: boolean
  attributeProfileId: string | null
  replacementNodeId: string | null
  sortOrder: number
  version: number
}

export class TaxonomyTransitionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "TaxonomyTransitionError"
  }
}

/**
 * Deprecate a node: allowed only from active, and only with a live
 * replacement. Never hard-delete an in-use category (ADR-001/002).
 */
export function deprecateCategory(
  node: Pick<TaxonomyNodeRow, "id" | "status">,
  replacement: Pick<TaxonomyNodeRow, "id" | "status"> | null,
): void {
  if (node.status !== "active") {
    throw new TaxonomyTransitionError("only active categories can be deprecated")
  }
  if (!replacement) {
    throw new TaxonomyTransitionError("deprecation requires a replacement node")
  }
  if (replacement.id === node.id) {
    throw new TaxonomyTransitionError("a category cannot replace itself")
  }
  if (replacement.status !== "active") {
    throw new TaxonomyTransitionError("replacement must be an active category")
  }
}

/**
 * Activate a proposed node after review. Active is the only state sellers
 * can publish into; deprecation leaves active only via a replacement.
 */
export function activateCategory(
  node: Pick<TaxonomyNodeRow, "id" | "status">,
): void {
  if (node.status !== "proposed") {
    throw new TaxonomyTransitionError("only proposed categories can be activated")
  }
}

/**
 * Follow deprecation redirects. Returns the terminal active node id, or the
 * input id when it is already active. Throws on cycles and on chains that
 * end at a non-active node without a replacement.
 */
export function resolveCategoryRedirect(
  startId: string,
  byId: Map<string, Pick<TaxonomyNodeRow, "id" | "status" | "replacementNodeId">>,
): string {
  const seen = new Set<string>()
  let current = startId
  for (;;) {
    if (seen.has(current)) throw new TaxonomyTransitionError("category redirect cycle")
    seen.add(current)
    const node = byId.get(current)
    if (!node) throw new TaxonomyTransitionError("unknown category")
    if (node.status === "active") return current
    if (node.status === "deprecated" && node.replacementNodeId) {
      current = node.replacementNodeId
      continue
    }
    throw new TaxonomyTransitionError("category is not browsable")
  }
}

/** Sellers may only publish into active, assignable nodes. */
export function assertAssignableCategory(
  node: Pick<TaxonomyNodeRow, "id" | "status" | "isAssignable">,
): void {
  if (node.status !== "active" || !node.isAssignable) {
    throw new TaxonomyTransitionError("products can only be assigned to active assignable categories")
  }
}

export function buildNavTree(
  rows: Array<{ id: string; handle: string; name: string; parentId: string | null; rank: number }>,
): CategoryNode[] {
  const sorted = [...rows].sort((a, b) => a.rank - b.rank || a.handle.localeCompare(b.handle))
  const map = new Map<string, CategoryNode>()
  for (const r of sorted) {
    map.set(r.id, { id: r.id, handle: r.handle, name: r.name, parentId: r.parentId, children: [] })
  }
  const roots: CategoryNode[] = []
  for (const r of sorted) {
    const node = map.get(r.id)!
    if (r.parentId && map.has(r.parentId)) map.get(r.parentId)!.children.push(node)
    else roots.push(node)
  }
  return roots
}

export function assertLeafCategory(node: CategoryNode): void {
  if (node.children.length > 0) throw new Error("category must be a leaf")
}
