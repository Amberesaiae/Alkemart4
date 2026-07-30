import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { adminProducts, featuredProducts } from "../../lib/api"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Button, Skeleton, EmptyState, Switch, Input } from "@workspace/ui"
import { PageShell } from "../../components/page-shell"
import { PageHeader } from "../../components/page-header"
import { Search } from "lucide-react"
import { toast } from "sonner"

export const Route = createFileRoute("/_authenticated/featured-products")({
  component: FeaturedProductsPage,
})

function FeaturedProductsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [offset, setOffset] = useState(0)
  const limit = 50

  const allProductsQuery = useQuery({
    queryKey: ["admin-products", offset, search],
    queryFn: () => adminProducts.list({ offset, limit, q: search || undefined }),
  })

  const featuredQuery = useQuery({
    queryKey: ["featured-products"],
    queryFn: () => featuredProducts.list(),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, featured }: { id: string; featured: boolean }) =>
      adminProducts.update(id, { metadata: { featured: String(featured) } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] })
      queryClient.invalidateQueries({ queryKey: ["featured-products"] })
      toast.success("Featured status updated")
    },
    onError: () => toast.error("Failed to update featured status"),
  })

  const featuredIds = new Set(
    (featuredQuery.data?.products || []).map((p) => p.id)
  )

  if (allProductsQuery.isError) {
    return (
      <PageShell>
        <div className="bg-destructive/10 text-destructive p-4 rounded-md flex items-center justify-between">
          <span>Failed to load products.</span>
          <Button variant="outline" size="sm" onClick={() => allProductsQuery.refetch()}>
            Retry
          </Button>
        </div>
      </PageShell>
    )
  }

  const products = allProductsQuery.data?.products || []

  return (
    <PageShell>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6">
        <PageHeader
          title="Featured Products"
          description="Select products to feature on the storefront homepage."
        />
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOffset(0) }}
            className="pl-9"
          />
        </div>
      </div>

      <div className="border rounded-xl bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Seller</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Featured</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allProductsQuery.isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                </TableRow>
              ))
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <EmptyState title="No products found" description={search ? "Try a different search term." : "No products have been created yet."} />
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.title || "Untitled"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {product.seller?.name || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.sale_status === "active" ? "success" : "secondary"} className="capitalize">
                      {product.sale_status || "draft"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={featuredIds.has(product.id)}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: product.id, featured: checked })
                      }
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between items-center mt-4">
        <span className="text-sm text-muted-foreground">
          {products.length ? `${offset + 1}–${offset + products.length}` : "0"} of {allProductsQuery.data?.count ?? "…"}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - limit))}>
            Previous
          </Button>
          <Button variant="outline" disabled={!allProductsQuery.data?.count || offset + limit >= (allProductsQuery.data?.count || 0)} onClick={() => setOffset((o) => o + limit)}>
            Next
          </Button>
        </div>
      </div>
    </PageShell>
  )
}
