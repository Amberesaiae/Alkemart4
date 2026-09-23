import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { adminTaxonomy } from "../../lib/api"
import type { AdminTaxonomyNode } from "../../lib/api"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Button, Modal, Skeleton, EmptyState, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui"
import { PageShell } from "../../components/page-shell"
import { PageHeader } from "../../components/page-header"
import { Plus } from "@phosphor-icons/react"
import { toast } from "sonner"

const KIND_LABEL: Record<string, string> = {
  other_bucket: "Other-bucket overflow",
  failed_match: "Failed identity match",
  thin_category: "Thin leaf",
}

/**
 * Workers-mode taxonomy board (Phase 1A lifecycle + Phase 8D evidence
 * review). Nodes are created as `proposed` and retired via deprecation
 * with a live replacement — never hard-deleted. Proposals are read-only
 * evidence; a human acts through create/deprecate above.
 */
export function WorkersTaxonomyPage() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [deprecateOf, setDeprecateOf] = useState<AdminTaxonomyNode | null>(null)

  const nodesQ = useQuery({ queryKey: ["admin-taxonomy"], queryFn: () => adminTaxonomy.list() })
  const proposalsQ = useQuery({ queryKey: ["admin-taxonomy-proposals"], queryFn: () => adminTaxonomy.proposals() })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-taxonomy"] })
    queryClient.invalidateQueries({ queryKey: ["admin-taxonomy-proposals"] })
  }

  if (nodesQ.isError) {
    return (
      <PageShell>
        <div className="bg-destructive/10 text-destructive p-4 rounded-md flex items-center justify-between">
          <span>Failed to load taxonomy.</span>
          <Button variant="outline" size="sm" onClick={() => { nodesQ.refetch(); proposalsQ.refetch() }}>
            Retry
          </Button>
        </div>
      </PageShell>
    )
  }

  const nodes = nodesQ.data?.items ?? []
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const proposals = proposalsQ.data?.proposals ?? []

  return (
    <PageShell>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6">
        <PageHeader
          title="Categories"
          description="Govern the marketplace taxonomy. New nodes start proposed; retirement always names a live replacement."
        />
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Category
        </Button>
      </div>

      <section aria-label="Taxonomy proposals" className="border rounded-xl bg-card p-5 mb-6">
        <h2 className="font-semibold text-lg">Proposals awaiting review</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Evidence only — nothing auto-applies. Act with New Category or Deprecate below.
        </p>
        <div className="mt-4">
          {proposalsQ.isLoading ? (
            <Skeleton className="h-4 w-64" />
          ) : proposals.length === 0 ? (
            <EmptyState title="No open proposals" description="The evidence pipelines found nothing needing taxonomy attention." />
          ) : (
            <ul className="space-y-3">
              {proposals.map((p) => (
                <li key={`${p.kind}:${p.ref}`} className="border rounded-lg p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{KIND_LABEL[p.kind] ?? p.kind}</Badge>
                    <span className="font-mono text-sm">{p.ref}</span>
                    <span className="text-sm text-muted-foreground">× {p.count}</span>
                  </div>
                  <p className="text-sm mt-2">{p.reason}</p>
                  {p.sample.length > 0 ? (
                    <p className="text-xs text-muted-foreground mt-1 font-mono truncate">
                      sample: {p.sample.slice(0, 3).join(", ")}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="border rounded-xl bg-card">
        <Table label="Taxonomy nodes">
          <caption className="sr-only">Taxonomy nodes list</caption>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Handle</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Parent</TableHead>
              <TableHead>Flags</TableHead>
              <TableHead className="w-28"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {nodesQ.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                </TableRow>
              ))
            ) : nodes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState title="No categories yet" description="Create your first category to build the marketplace taxonomy." />
                </TableCell>
              </TableRow>
            ) : (
              nodes.map((n) => (
                <TableRow key={n.id}>
                  <TableCell>
                    <div className="flex items-center gap-2" style={{ paddingLeft: n.level * 16 }}>
                      <span className="font-medium">{n.displayName || n.canonicalName}</span>
                    </div>
                  </TableCell>
                  <TableCell><span className="font-mono text-xs">{n.handle}</span></TableCell>
                  <TableCell>
                    <Badge variant={n.status === "active" ? "success" : n.status === "proposed" ? "secondary" : "destructive"}>
                      {n.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{n.parentId ? byId.get(n.parentId)?.canonicalName ?? "—" : "—"}</TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {[n.isBrowseable && "browse", n.isAssignable && "assign", n.isNavVisible && "nav"].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {n.status !== "deprecated" ? (
                      <Button variant="outline" size="sm" onClick={() => setDeprecateOf(n)}>
                        Deprecate
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">retired</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {showCreate && (
        <CreateNodeModal nodes={nodes} onClose={() => setShowCreate(false)} onDone={invalidate} />
      )}
      {deprecateOf && (
        <DeprecateModal
          node={deprecateOf}
          nodes={nodes}
          onClose={() => setDeprecateOf(null)}
          onDone={invalidate}
        />
      )}
    </PageShell>
  )
}

function CreateNodeModal({ nodes, onClose, onDone }: {
  nodes: AdminTaxonomyNode[]
  onClose: () => void
  onDone: () => void
}) {
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [parentId, setParentId] = useState<string>("__top")
  const create = useMutation({
    mutationFn: () =>
      adminTaxonomy.create({
        code: code.trim(),
        name: name.trim(),
        parentId: parentId === "__top" ? null : parentId,
      }),
    onSuccess: () => {
      toast.success("Category proposed")
      onDone()
      onClose()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to create category"),
  })
  const valid = code.trim().length > 0 && name.trim().length > 0
  return (
    <Modal isOpen onClose={onClose} title="New Category">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Starts as <span className="font-medium text-foreground">proposed</span> until activated.</p>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="node-code">Code</label>
          <Input id="node-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="phones" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="node-name">Name</label>
          <Input id="node-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Phones" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="node-parent">Parent</label>
          <Select value={parentId} onValueChange={setParentId}>
            <SelectTrigger id="node-parent"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__top">Top level</SelectItem>
              {nodes.filter((n) => n.status === "active").map((n) => (
                <SelectItem key={n.id} value={n.id}>{n.canonicalName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={!valid || create.isPending}>
            {create.isPending ? "Proposing..." : "Propose category"}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function DeprecateModal({ node, nodes, onClose, onDone }: {
  node: AdminTaxonomyNode
  nodes: AdminTaxonomyNode[]
  onClose: () => void
  onDone: () => void
}) {
  const [replacementId, setReplacementId] = useState("")
  const candidates = nodes.filter((n) => n.id !== node.id && n.status === "active")
  const deprecate = useMutation({
    mutationFn: () => adminTaxonomy.deprecate(node.id, replacementId),
    onSuccess: () => {
      toast.success("Category deprecated")
      onDone()
      onClose()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to deprecate category"),
  })
  return (
    <Modal isOpen onClose={onClose} title="Deprecate Category">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Retire <span className="font-medium text-foreground">{node.canonicalName}</span>? Listings move to the
          replacement — retirement never deletes.
        </p>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="node-replacement">Replacement</label>
          <Select value={replacementId} onValueChange={setReplacementId}>
            <SelectTrigger id="node-replacement"><SelectValue placeholder="Choose a live category" /></SelectTrigger>
            <SelectContent>
              {candidates.map((n) => (
                <SelectItem key={n.id} value={n.id}>{n.canonicalName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={deprecate.isPending}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={() => deprecate.mutate()}
            disabled={!replacementId || deprecate.isPending}
          >
            {deprecate.isPending ? "Retiring..." : "Deprecate"}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
