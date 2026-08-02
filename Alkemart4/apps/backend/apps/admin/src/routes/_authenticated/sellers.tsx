import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { useAdminSellersList } from "../../hooks/use-sellers-admin"
import type { AdminSeller } from "../../lib/api"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Button, Skeleton, EmptyState, Input } from "@workspace/ui"
import { PageShell } from "../../components/page-shell"
import { PageHeader } from "../../components/page-header"
import { Store, Search } from "lucide-react"

export const Route = createFileRoute("/_authenticated/sellers")({
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

  const handleSearch = (val: string) => {
    setSearch(val)
    clearTimeout((handleSearch as { _t?: ReturnType<typeof setTimeout> })._t)
    const t = setTimeout(() => { setDebouncedSearch(val); setOffset(0) }, 350)
    ;(handleSearch as { _t?: ReturnType<typeof setTimeout> })._t = t
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <PageHeader title="All Sellers" description="Browse and manage every seller on the platform." />
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 h-10"
            placeholder="Search by name or handle…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="border rounded-xl bg-card">
        <Table>
          <caption className="sr-only">Sellers list</caption>
          <TableHeader>
            <TableRow>
              <TableHead>Seller</TableHead>
              <TableHead>Handle</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                </TableRow>
              ))
            ) : sellers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState
                    icon={<Store className="h-8 w-8 opacity-40" />}
                    title="No sellers found"
                    description={debouncedSearch ? "Try a different search term." : "No sellers have registered yet."}
                  />
                </TableCell>
              </TableRow>
            ) : (
              sellers.map((seller: AdminSeller) => (
                <TableRow key={seller.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-semibold">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-muted border flex items-center justify-center shrink-0">
                        <Store className="h-4 w-4 text-muted-foreground" />
                      </div>
                      {seller.name || "Unnamed"}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm">@{seller.handle}</TableCell>
                  <TableCell><SellerStatusBadge status={seller.status} /></TableCell>
                  <TableCell className="text-muted-foreground text-sm">{seller.email || "-"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(seller.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Link to="/sellers/$id" params={{ id: seller.id }}>
                      <Button variant="outline" size="sm">View</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">
          {sellers.length ? `${offset + 1}–${offset + sellers.length}` : "0"} of {data?.count ?? "…"}
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
