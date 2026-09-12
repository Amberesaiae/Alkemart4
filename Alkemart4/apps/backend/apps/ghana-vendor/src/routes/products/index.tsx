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
  Sparkle,
  ArrowRight,
  Cube,
} from "@phosphor-icons/react"
import { PageShell } from "../../components/page-shell"

export const Route = createFileRoute('/products/')({
  component: ProductsPage,
})

const PAGE_SIZE = 20

function storefrontBase(): string {
  const raw = (import.meta.env.VITE_ALKEMART_STOREFRONT_URL as string | undefined)?.trim()
  return (raw ? raw : "http://127.0.0.1:5175").replace(/\/$/, "")
}

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

  // High-value merchant catalog computations
  const stats = useMemo(() => {
    const total = allProducts.length
    const published = allProducts.filter((p) => p.status === "published").length
    const inReview = allProducts.filter((p) => p.status === "proposed").length
    const drafts = allProducts.filter((p) => p.status === "draft" || !p.status).length
    const rejected = allProducts.filter((p) => p.status === "rejected").length
    const totalStock = allProducts.reduce((acc, p) => acc + (typeof p.metadata?.onHand === "number" ? p.metadata.onHand : 0), 0)
    const totalValuation = allProducts.reduce((acc, p) => {
      const price = p.variants?.[0]?.prices?.[0]?.amount ?? 0
      const stock = typeof p.metadata?.onHand === "number" ? (p.metadata.onHand as number) : 0
      return acc + (price * stock)
    }, 0)
    return { total, published, inReview, drafts, rejected, totalStock, totalValuation }
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
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-600 text-white shadow-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> Live
          </span>
        )
      case "proposed":
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-primary text-primary-foreground shadow-xs">
            <Clock className="h-3 w-3" weight="bold" /> In Review
          </span>
        )
      case "rejected": {
        const meta = product?.metadata as Record<string, unknown> | undefined
        const alk = meta?.alkemart as Record<string, unknown> | undefined
        const mod = alk?.moderation as Record<string, unknown> | undefined
        const reason = mod?.reason as string | undefined
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-600 text-white shadow-xs group relative cursor-help" title={reason || "Rejected"}>
            <WarningCircle className="h-3 w-3" weight="bold" />
            Rejected
            {reason && (
              <span className="absolute bottom-full right-0 mb-2 hidden group-hover:block bg-popover text-popover-foreground text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap z-10 max-w-64 overflow-hidden text-ellipsis border">
                {reason}
              </span>
            )}
          </span>
        )
      }
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white text-foreground border border-border/60">
            Draft
          </span>
        )
    }
  }

  const categoryNameOf = (id?: string) => {
    if (!id) return null
    return categories.find((c) => c.id === id)?.name ?? null
  }

  return (
    <PageShell>
      {/* ── Bespoke Page Header: High-Impact Merchant Overview ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-foreground">Catalog &amp; Inventory</h1>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-muted text-primary-foreground border border-primary/25">
              {stats.total} {stats.total === 1 ? "Listing" : "Listings"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2">
            <span>{stats.totalStock.toLocaleString()} total units in stock</span>
            {stats.totalValuation > 0 && (
              <>
                <span className="text-border">•</span>
                <span className="font-semibold text-foreground/80">
                  Valuation: GH₵ {stats.totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </>
            )}
          </p>
        </div>

        <Link to="/quick-sell">
          <Button size="default" className="w-full sm:w-auto gap-2 shadow-sm font-bold px-5 rounded-xl">
            <PlusCircle className="h-4 w-4" weight="bold" />
            Add Product
          </Button>
        </Link>
      </div>

      {/* ── Proper, Large Interactive Status Tabs ── */}
      {!isLoading && !isError && allProducts.length > 0 && (
        <div className="space-y-4 pt-1">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {[
              { id: "all", label: "All Items", count: stats.total, dot: null },
              { id: "published", label: "Live on Store", count: stats.published, dot: "bg-emerald-500" },
              { id: "proposed", label: "In Review", count: stats.inReview, dot: "bg-primary" },
              { id: "draft", label: "Drafts", count: stats.drafts + stats.rejected, dot: "bg-neutral-400" },
            ].map((tab) => {
              const isSelected = statusFilter === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`group relative text-left p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between gap-2 ${
                    isSelected
                      ? "bg-card border-primary ring-2 ring-primary/20 shadow-sm"
                      : "bg-card/70 hover:bg-card border-border/80 hover:border-primary/40 hover:shadow-2xs"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-bold uppercase tracking-wider ${
                      isSelected ? "text-foreground font-black" : "text-muted-foreground group-hover:text-foreground"
                    }`}>
                      {tab.label}
                    </span>
                    {tab.dot ? (
                      <span className="flex items-center gap-1">
                        <span className={`h-2.5 w-2.5 rounded-full ${tab.dot} ${tab.id === "published" ? "animate-pulse" : ""}`} />
                      </span>
                    ) : (
                      <Package className={`h-4 w-4 ${isSelected ? "text-primary" : "text-muted-foreground/50"}`} />
                    )}
                  </div>

                  <div className="flex items-baseline justify-between mt-1">
                    <span className={`text-2xl sm:text-3xl font-black tabular-nums tracking-tight ${
                      isSelected ? "text-foreground" : "text-foreground/80"
                    }`}>
                      {tab.count}
                    </span>
                    {isSelected && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-primary px-2 py-0.5 rounded-full bg-muted border border-primary/20">
                        Selected
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* ── Spacious Horizontal Search & Controls Section ── */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2 rounded-2xl border border-border/80 bg-card/60 shadow-2xs">
            <div className="relative flex-1">
              <MagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-10.5 text-sm bg-background border-border/70 focus:border-primary rounded-xl transition-colors w-full"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              {search && (
                <span className="text-xs text-muted-foreground font-medium px-2">
                  {filteredProducts.length} {filteredProducts.length === 1 ? "result" : "results"}
                </span>
              )}

              <div className="inline-flex rounded-xl border border-border/80 p-1 bg-muted/30">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    viewMode === "grid"
                      ? "bg-card text-foreground shadow-xs border border-border/80"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Grid view"
                >
                  <SquaresFour className="h-4 w-4" weight={viewMode === "grid" ? "bold" : "regular"} />
                  <span>Grid</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    viewMode === "table"
                      ? "bg-card text-foreground shadow-xs border border-border/80"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Table view"
                >
                  <ListBullets className="h-4 w-4" weight={viewMode === "table" ? "bold" : "regular"} />
                  <span>Table</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Content Area ── */}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-80 animate-pulse bg-muted/40 border-border/60 rounded-2xl" />
          ))}
        </div>
      ) : allProducts.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-14 text-center border-dashed border-2 shadow-xs bg-muted/10 rounded-2xl">
          <div className="h-16 w-16 bg-muted text-primary rounded-2xl flex items-center justify-center mb-4 shadow-inner">
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
        /* ── Bespoke Product Cards: Distinctive, High-Density Merchant Aesthetic ── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-stretch">
          {filteredProducts.map((product) => {
            const price = product.variants?.[0]?.prices?.[0]?.amount ?? 0
            const stock = typeof product.metadata?.onHand === "number" ? (product.metadata.onHand as number) : null
            const categoryName = categoryNameOf(product.categories?.[0]?.id)
            const storefrontUrl = product.handle ? `${storefrontBase()}/products/${product.handle}` : null

            return (
              <div
                key={product.id}
                className="group relative flex flex-col rounded-2xl border border-border/80 bg-card overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-primary/50"
              >
                {/* Media Showcase Frame with Status & Storefront Link */}
                <div className="aspect-[16/10] bg-white relative overflow-hidden">
                  {product.thumbnail ? (
                    <img
                      src={product.thumbnail}
                      alt={product.title || "Product"}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/30">
                      <Package className="h-10 w-10 stroke-[1.5]" />
                      <span className="text-[11px] font-semibold mt-1">No Image</span>
                    </div>
                  )}

                  {/* Status Overlay */}
                  <div className="absolute top-3 right-3 z-10">
                    {getStatusBadge(product.status || "draft", product)}
                  </div>

                  {/* Live Storefront Link */}
                  {product.status === "published" && storefrontUrl && (
                    <a
                      href={storefrontUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="absolute top-3 left-3 z-10 inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-background/90 text-foreground border border-border/60 shadow-2xs backdrop-blur hover:bg-background hover:text-primary transition-colors"
                      title="View live product listing on storefront"
                    >
                      <ArrowSquareOut className="h-3 w-3" />
                      Storefront
                    </a>
                  )}

                  {/* Floating Category Pill */}
                  {categoryName && (
                    <span className="absolute bottom-3 left-3 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-background/90 text-foreground border border-border/60 shadow-2xs backdrop-blur">
                      {categoryName}
                    </span>
                  )}
                </div>

                {/* Card Body */}
                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-base text-foreground line-clamp-1 group-hover:text-primary transition-colors tracking-tight" title={product.title || "Untitled"}>
                      {product.title || "Untitled"}
                    </h3>
                    <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                      Ref: {product.handle || product.id.slice(0, 10)}
                    </p>
                  </div>

                  {/* Price & Stock Commercial Specs */}
                  <div className="flex items-end justify-between pt-3 border-t border-border/60">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Selling Price</p>
                      <p className="text-xl font-black text-foreground whitespace-nowrap tabular-nums">
                        {price > 0 ? `GH₵ ${price.toFixed(2)}` : "—"}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Inventory</p>
                      {stock !== null ? (
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                          stock > 0
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                            : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${stock > 0 ? "bg-emerald-500" : "bg-rose-500"}`} />
                          {stock > 0 ? `${stock} in stock` : "Out of stock"}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground font-medium">Standard</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="p-3 bg-muted/15 border-t border-border/60 flex items-center gap-2">
                  <Link to="/products/$id" params={{ id: product.id }} className="flex-1">
                    <Button className="w-full gap-1.5 h-8.5 text-xs font-bold rounded-xl" size="sm" variant="outline">
                      <PencilSimple className="h-3.5 w-3.5 text-primary" />
                      Manage Listing
                    </Button>
                  </Link>

                  {product.status === "draft" && (
                    <Button
                      size="sm"
                      className="h-8.5 text-xs font-semibold gap-1 rounded-xl"
                      onClick={() => handlePropose(product.id)}
                      isLoading={propose.isPending && propose.variables === product.id}
                    >
                      Submit
                    </Button>
                  )}
                </div>
              </div>
            )
          })}

          {/* Quick-Add Companion Card when catalog has few items to balance layout */}
          {filteredProducts.length <= 2 && statusFilter === "all" && search === "" && (
            <Link
              to="/quick-sell"
              className="group relative flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-border/80 hover:border-primary bg-muted/10 hover:bg-muted/20 transition-all min-h-[320px] text-center"
            >
              <div className="h-12 w-12 rounded-2xl bg-muted text-primary flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <PlusCircle className="h-6 w-6" weight="bold" />
              </div>
              <h4 className="font-bold text-sm text-foreground mb-1">Add Another Product</h4>
              <p className="text-xs text-muted-foreground max-w-xs mb-4">
                Expand your catalog with more variants, photography, and inventory to drive marketplace sales.
              </p>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary group-hover:underline">
                Create Listing <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          )}
        </div>
      ) : (
        /* ── Refined Table View ── */
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
                const storefrontUrl = product.handle ? `${storefrontBase()}/products/${product.handle}` : null

                return (
                  <TableRow key={product.id} className="hover:bg-muted/20">
                    <TableCell>
                      <div className="h-11 w-11 rounded-xl overflow-hidden bg-muted/60 border border-border/60 flex items-center justify-center">
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
                        {product.handle ? `Ref: ${product.handle.slice(0, 14)}` : `ID: ${product.id.slice(0, 8)}`}
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
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                          stock > 0 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                        }`}>
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
                        {product.status === "published" && storefrontUrl && (
                          <a href={storefrontUrl} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-primary" title="View live on storefront">
                              <ArrowSquareOut className="h-4 w-4" />
                            </Button>
                          </a>
                        )}
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
