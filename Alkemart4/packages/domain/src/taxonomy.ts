export type CategoryNode = {
  id: string
  handle: string
  name: string
  parentId: string | null
  children: CategoryNode[]
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
