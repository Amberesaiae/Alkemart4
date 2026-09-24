import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { useAdminSellersList } from "../../hooks/use-sellers-admin"
import type { AdminSeller } from "../../lib/api"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Button, Skeleton, EmptyState, Input } from "@workspace/ui"
import { PageShell } from "../../components/page-shell"
import { PageHeader } from "../../components/page-header"
import { Storefront, MagnifyingGlass } from "@phosphor-icons/react"

export const Route = createFileRoute("/_authenticated/sellers/")({
  component: SellersPage,
})

function SellerStatusBadge({ status }: { status?: string }) {
  const map: Record<string, "success" | "destructive" | "warning" | "secondary"> = {
    open: "success",
    suspended: "destructive",
    terminated: "destructive",
    pending_approval: "warning",
  }
  return (
    <Badge variant={map[status || ""] ?? "secondary"} className="capitalize">
      {status?.replace(/_/g, " ") || "Unknown"}
    </Badge>
  )
}

function SellersPage() {
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const limit = 50

  const { data, isLoading, isError, refetch } = useAdminSellersList({
    limit,
    offset,
    q: debouncedSearch || undefined,
  })

  const sellers = data?.sellers || []
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const sorted = [...sellers].sort((a, b) =>
    sortDir === "asc"
      ? (a.name || "").localeCompare(b.name || "")
      : (b.name || "").localeCompare(a.name || ""),
  )

  const handleSearch = (val: string) => {
    setSearch(val)
    clearTimeout((handleSearch as { _t?: ReturnType<typeof setTimeout> })._t)
    const t = setTimeout(() => { setDebouncedSearch(val); setOffset(0) }, 350)
      ; (handleSearch as { _t?: ReturnType<typeof setTimeout> })._t = t
  }

  if (isError) {
    return (
      <PageShell>
        <div className="bg-destructive/10 text-destructive p-4 rounded-md flex items-center justify-between">
          <span>Failed to load sellers.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader title="All Sellers" description="Browse and manage every seller on the platform." />
        <div className="relative w-full sm:w-64">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 h-10"
            placeholder="Search by name or handle…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="border rounded-lg bg-card">
        <Table label="All sellers">
          <caption className="sr-only">Sellers list</caption>
          <TableHeader>
            <TableRow>
              <TableHead aria-sort={sortDir === "asc" ? "ascending" : "descending"}>
                <button
                  type="button"
                  onClick={() => setSortDir(d => (d === "asc" ? "desc" : "asc"))}
                  className="inline-flex items-center gap-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
                  aria-label={`Sort sellers by name, currently ${sortDir === "asc" ? "ascending" : "descending"}`}
                >
                  Seller
                  <span aria-hidden="true" className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>
                </button>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right tabular-nums">Orders</TableHead>
              <TableHead className="text-right tabular-nums">GMV</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-20 text-right"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-8 w-8 rounded-lg" />
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto rounded-lg" /></TableCell>
                </TableRow>
              ))
            ) : sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState
                    icon={<Storefront className="h-8 w-8 opacity-40" />}
                    title="No sellers found"
                    description={debouncedSearch ? "Try a different search term." : "No sellers have registered yet."}
                  />
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((seller: AdminSeller) => (
                <TableRow key={seller.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-muted border border-primary/20 flex items-center justify-center shrink-0">
                        <Storefront className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold leading-tight truncate">{seller.name || "Unnamed"}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">@{seller.handle}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><SellerStatusBadge status={seller.status} /></TableCell>
                  <TableCell className="text-right tabular-nums">{seller.orderCount ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    GH₵ {((Number(seller.gmvPesewas ?? "0") || 0) / 100).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {seller.created_at ? new Date(seller.created_at).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link to="/sellers/$id" params={{ id: seller.id }}>
                      <Button size="sm">View</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {sorted.length ? `${offset + 1}–${offset + sorted.length}` : "0"} of {data?.count ?? "…"}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - limit))}>
            Previous
          </Button>
          <Button variant="outline" disabled={!data?.count || offset + limit >= (data?.count || 0)} onClick={() => setOffset(o => o + limit)}>
            Next
          </Button>
        </div>
      </div>
    </PageShell>
  )
}
