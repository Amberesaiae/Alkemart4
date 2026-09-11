import { createFileRoute, Link } from "@tanstack/react-router"
import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useProducts, useProposeProduct, useCategories } from "../../lib/hooks"
import { Card, Button, Badge, Input, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@workspace/ui"
import {
  PlusCircle,
  CheckCircle,
  Clock,
  WarningCircle,
  MagnifyingGlass,
  SquaresFour,
  ListBullets,
  Package,
  PencilSimple,
  ArrowSquareOut,
  Tag,
  X,
} from "@phosphor-icons/react"
import { PageShell } from "../../components/page-shell"
import { PageHeader } from "../../components/page-header"

export const Route = createFileRoute('/products/')({
  component: ProductsPage,
})

const PAGE_SIZE = 20

function ProductsPage() {
  const qc = useQueryClient()
  const [offset, setOffset] = useState(0)
  const { data, isLoading, isError } = useProducts({ limit: PAGE_SIZE, offset })
  const { data: categoriesData } = useCategories()
  const propose = useProposeProduct()

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid")

  const categories = categoriesData?.product_categories ?? []

  const handlePropose = (id: string) => {
    propose.mutate(id)
  }

  const allProducts = data?.products ?? []

  // Stats computation
  const stats = useMemo(() => {
    const total = allProducts.length
    const published = allProducts.filter((p) => p.status === "published").length
    const inReview = allProducts.filter((p) => p.status === "proposed").length
    const drafts = allProducts.filter((p) => p.status === "draft" || !p.status).length
    const rejected = allProducts.filter((p) => p.status === "rejected").length
    return { total, published, inReview, drafts, rejected }
  }, [allProducts])

  // Filter products by search and status
  const filteredProducts = useMemo(() => {
    return allProducts.filter((p) => {
      const matchesSearch =
        search.trim() === "" ||
        (p.title || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.handle || "").toLowerCase().includes(search.toLowerCase())

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "draft" ? p.status === "draft" || !p.status : p.status === statusFilter)

      return matchesSearch && matchesStatus
    })
  }, [allProducts, search, statusFilter])

  const getStatusBadge = (status: string, product?: Record<string, unknown>) => {
    switch (status) {
      case "published":
        return (
          <Badge variant="success" className="gap-1 shadow-2xs text-[11px] font-semibold py-0.5 px-2">
            <CheckCircle className="h-3 w-3" /> Published
          </Badge>
        )
      case "proposed":
        return (
          <Badge variant="warning" className="gap-1 shadow-2xs text-[11px] font-semibold py-0.5 px-2">
            <Clock className="h-3 w-3" /> In Review
          </Badge>
        )
      case "rejected": {
        const meta = product?.metadata as Record<string, unknown> | undefined
        const alk = meta?.alkemart as Record<string, unknown> | undefined
        const mod = alk?.moderation as Record<string, unknown> | undefined
        const reason = mod?.reason as string | undefined
        return (
          <Badge variant="destructive" className="gap-1 text-[11px] font-semibold py-0.5 px-2 group relative" title={reason || "Rejected"}>
            <WarningCircle className="h-3 w-3" />
            Rejected
            {reason && (
              <span className="absolute bottom-full right-0 mb-2 hidden group-hover:block bg-popover text-popover-foreground text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap z-10 max-w-64 overflow-hidden text-ellipsis border">
                {reason}
              </span>
            )}
          </Badge>
        )
      }
      default:
        return <Badge variant="secondary" className="gap-1 text-[11px] font-semibold py-0.5 px-2">Draft</Badge>
    }
  }

  const categoryNameOf = (id?: string) => {
    if (!id) return null
    return categories.find((c) => c.id === id)?.name ?? null
  }

  return (
    <PageShell>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <PageHeader title="Products" description="Manage your inventory, prices, and marketplace listings." />
        <Link to="/quick-sell">
          <Button size="lg" className="w-full sm:w-auto gap-2 shadow-sm font-bold">
            <PlusCircle className="h-5 w-5" weight="bold" />
            Add Product
          </Button>
        </Link>
      </div>

      {/* Summary Metrics Bar */}
      {!isLoading && !isError && allProducts.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <Card className="p-4 shadow-2xs flex items-center gap-3.5 rounded-2xl border bg-card">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
              <Package className="h-5 w-5" weight="bold" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Total Listings</p>
              <p className="text-2xl font-black text-foreground tracking-tight">{stats.total}</p>
            </div>
          </Card>

          <Card className="p-4 shadow-2xs flex items-center gap-3.5 rounded-2xl border bg-card">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 shrink-0">
              <CheckCircle className="h-5 w-5" weight="bold" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Published</p>
              <p className="text-2xl font-black text-foreground tracking-tight">{stats.published}</p>
            </div>
          </Card>

          <Card className="p-4 shadow-2xs flex items-center gap-3.5 rounded-2xl border bg-card">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 shrink-0">
              <Clock className="h-5 w-5" weight="bold" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">In Review</p>
              <p className="text-2xl font-black text-foreground tracking-tight">{stats.inReview}</p>
            </div>
          </Card>

          <Card className="p-4 shadow-2xs flex items-center gap-3.5 rounded-2xl border bg-card">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground shrink-0">
              <Tag className="h-5 w-5" weight="bold" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Drafts &amp; Other</p>
              <p className="text-2xl font-black text-foreground tracking-tight">{stats.drafts + stats.rejected}</p>
            </div>
          </Card>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      {!isLoading && !isError && allProducts.length > 0 && (
        <div className="p-2 bg-card border border-border/80 rounded-2xl shadow-2xs flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search products by title or ref..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs bg-muted/20 border-border/60 rounded-xl"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Status Filter Tabs */}
            <div className="inline-flex rounded-xl border border-border/60 p-1 bg-muted/30 text-xs font-semibold">
              {[
                { id: "all", label: "All" },
                { id: "published", label: `Live (${stats.published})` },
                { id: "proposed", label: `Review (${stats.inReview})` },
                { id: "draft", label: `Draft (${stats.drafts})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    statusFilter === tab.id
                      ? "bg-card text-foreground shadow-2xs font-bold border border-border/60"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* View Mode Switcher */}
            <div className="inline-flex rounded-xl border border-border/60 p-1 bg-muted/30">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === "grid"
                    ? "bg-card text-foreground shadow-2xs font-bold border border-border/60"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Grid view"
              >
                <SquaresFour className="h-4 w-4" weight={viewMode === "grid" ? "bold" : "regular"} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === "table"
                    ? "bg-card text-foreground shadow-2xs font-bold border border-border/60"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Table view"
              >
                <ListBullets className="h-4 w-4" weight={viewMode === "table" ? "bold" : "regular"} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {isError ? (
        <Card className="p-8 text-center border border-destructive/20 shadow-xs rounded-2xl">
          <WarningCircle className="h-10 w-10 mx-auto mb-3 text-destructive" />
          <h2 className="text-lg font-bold mb-1">Failed to load products</h2>
          <p className="text-muted-foreground text-sm mb-4">Something went wrong. Please try again.</p>
          <Button onClick={() => { qc.invalidateQueries({ queryKey: ["vendor", "products"] }) }} variant="outline" className="gap-2">
            Retry
          </Button>
        </Card>
      ) : isLoading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,340px))] gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="h-80 animate-pulse bg-muted/40 border-border/60 rounded-2xl" />
          ))}
        </div>
      ) : allProducts.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-14 text-center border-dashed border-2 shadow-xs bg-muted/10 rounded-2xl">
          <div className="h-16 w-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4 shadow-inner">
            <Package className="h-8 w-8" weight="bold" />
          </div>
          <h2 className="text-xl font-bold mb-1">No products yet</h2>
          <p className="text-muted-foreground text-sm font-medium mb-6 max-w-sm">
            Add your first item with photos, pricing, and stock to start selling across the marketplace.
          </p>
          <Link to="/quick-sell">
            <Button size="lg" className="gap-2 shadow-sm font-bold">
              <PlusCircle className="h-5 w-5" weight="bold" />
              Add First Product
            </Button>
          </Link>
        </Card>
      ) : filteredProducts.length === 0 ? (
        <Card className="p-12 text-center shadow-xs rounded-2xl">
          <MagnifyingGlass className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
          <p className="font-bold text-base text-foreground mb-1">No matching products</p>
          <p className="text-sm text-muted-foreground mb-4">No products found matching your current search or status filter.</p>
          <Button variant="outline" size="sm" onClick={() => { setSearch(""); setStatusFilter("all") }}>
            Reset Filters
          </Button>
        </Card>
      ) : viewMode === "grid" ? (
        /* ── Refined Grid View: Perfectly proportioned cards that never squeeze ── */
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,340px))] gap-6 items-start">
          {filteredProducts.map((product) => {
            const price = product.variants?.[0]?.prices?.[0]?.amount ?? 0
            const stock = typeof product.metadata?.onHand === "number" ? (product.metadata.onHand as number) : null
            const categoryName = categoryNameOf(product.categories?.[0]?.id)

            return (
              <Card
                key={product.id}
                className="overflow-hidden border border-border/80 hover:border-primary/50 transition-all duration-200 hover:shadow-md flex flex-col group rounded-2xl bg-card"
              >
                {/* Image Container with overlay badges */}
                <div className="aspect-[4/3] bg-muted/50 relative overflow-hidden">
                  {product.thumbnail ? (
                    <img
                      src={product.thumbnail}
                      alt={product.title || "Product"}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40">
                      <Package className="h-10 w-10 stroke-[1.5]" />
                      <span className="text-[11px] font-semibold mt-1">No Image</span>
                    </div>
                  )}

                  {/* Status Badge */}
                  <div className="absolute top-2.5 right-2.5">
                    {getStatusBadge(product.status || "draft", product)}
                  </div>
                </div>

                {/* Details Section */}
                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    {categoryName && (
                      <span className="text-[11px] font-bold text-primary uppercase tracking-wider block truncate">
                        {categoryName}
                      </span>
                    )}
                    <h3 className="font-bold text-base text-foreground line-clamp-1 group-hover:text-primary transition-colors" title={product.title || "Untitled"}>
                      {product.title || "Untitled"}
                    </h3>
                    <p className="text-xs text-muted-foreground font-mono">
                      Ref: {product.handle?.slice(0, 10) || product.id.slice(0, 8)}
                    </p>
                  </div>

                  {/* Price & Stock info: Always clean, non-wrapping horizontal layout */}
                  <div className="flex items-end justify-between pt-2.5 border-t border-border/60">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Price</p>
                      <p className="text-lg font-black text-foreground whitespace-nowrap tabular-nums">
                        {price > 0 ? `GH₵ ${price.toFixed(2)}` : "—"}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Stock</p>
                      <span className={`inline-flex items-center text-xs font-bold whitespace-nowrap ${stock !== null && stock > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                        {stock !== null ? (stock > 0 ? `${stock} in stock` : "Out of stock") : "Standard"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="p-3 bg-muted/20 border-t border-border/60 flex items-center gap-2">
                  <Link to="/products/$id" params={{ id: product.id }} className="flex-1">
                    <Button className="w-full gap-1.5 h-8 text-xs font-semibold" size="sm" variant="outline">
                      <PencilSimple className="h-3.5 w-3.5" />
                      View &amp; Edit
                    </Button>
                  </Link>

                  {product.status === "draft" && (
                    <Button
                      size="sm"
                      className="h-8 text-xs font-semibold gap-1"
                      onClick={() => handlePropose(product.id)}
                      isLoading={propose.isPending && propose.variables === product.id}
                    >
                      Submit
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        /* ── Table View ── */
        <Card className="overflow-hidden shadow-2xs rounded-2xl border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-16">Item</TableHead>
                <TableHead>Title &amp; Reference</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-center">Stock</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => {
                const price = product.variants?.[0]?.prices?.[0]?.amount ?? 0
                const stock = typeof product.metadata?.onHand === "number" ? (product.metadata.onHand as number) : null
                const categoryName = categoryNameOf(product.categories?.[0]?.id)

                return (
                  <TableRow key={product.id} className="hover:bg-muted/20">
                    <TableCell>
                      <div className="h-10 w-10 rounded-lg overflow-hidden bg-muted/60 border border-border/60 flex items-center justify-center">
                        {product.thumbnail ? (
                          <img src={product.thumbnail} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Package className="h-5 w-5 text-muted-foreground/40" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link to="/products/$id" params={{ id: product.id }} className="font-bold text-sm hover:text-primary transition-colors line-clamp-1">
                        {product.title || "Untitled"}
                      </Link>
                      <span className="text-xs text-muted-foreground font-mono">
                        {product.handle ? `Ref: ${product.handle.slice(0, 10)}` : `ID: ${product.id.slice(0, 8)}`}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-medium text-muted-foreground">
                        {categoryName || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-bold text-sm tabular-nums whitespace-nowrap">
                      {price > 0 ? `GH₵ ${price.toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {stock !== null ? (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${stock > 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                          {stock > 0 ? `${stock} left` : "Out"}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(product.status || "draft", product)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link to="/products/$id" params={{ id: product.id }}>
                          <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs font-semibold gap-1">
                            <PencilSimple className="h-3.5 w-3.5" /> Edit
                          </Button>
                        </Link>
                        {product.status === "draft" && (
                          <Button
                            size="sm"
                            className="h-8 px-2.5 text-xs font-semibold"
                            onClick={() => handlePropose(product.id)}
                            isLoading={propose.isPending && propose.variables === product.id}
                          >
                            Submit
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Pagination Bar */}
      {(data?.count ?? 0) > PAGE_SIZE && (
        <div className="flex justify-between items-center mt-4">
          <span className="text-xs text-muted-foreground font-medium">
            Showing {data?.products?.length ? `${offset + 1}–${offset + data.products.length}` : "0"} of {data?.count} items
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={offset + PAGE_SIZE >= (data?.count || 0)} onClick={() => setOffset((o) => o + PAGE_SIZE)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </PageShell>
  )
}