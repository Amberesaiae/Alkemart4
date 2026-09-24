import { createFileRoute, Link } from "@tanstack/react-router"
import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useProducts, useProposeProduct, useCategories, useUpdateVariant } from "../../lib/hooks"
import { toast } from "sonner"
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
  ArrowRight,
  Cube,
  Minus,
  Plus,
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

/**
 * Per-card commerce controls: stock stepper + live toggle. Both ride the
 * variant PATCH endpoint, which never triggers re-review — safe to fire
 * inline from the grid. Hidden when the card lacks variant/stock data
 * instead of guessing.
 */
function QuickStockRow({
  productId,
  variantId,
  stock,
  active,
}: {
  productId: string
  variantId: string | null
  stock: number | null
  active: boolean | undefined
}) {
  const updateVariant = useUpdateVariant()
  if (!variantId || stock === null) return null
  const busy = updateVariant.isPending
  const send = (patch: { onHand?: number; active?: boolean }, ok: string) =>
    updateVariant.mutate(
      { productId, variantId, patch },
      {
        onSuccess: () => toast.success(ok),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't update stock."),
      },
    )
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1" role="group" aria-label="Adjust stock">
        <button
          type="button"
          disabled={busy || stock <= 0}
          onClick={() => send({ onHand: stock - 1 }, "Stock updated.")}
          aria-label="Decrease stock by one"
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/80 text-muted-foreground hover:text-foreground hover:border-foreground disabled:opacity-40"
        >
          <Minus className="h-3.5 w-3.5" weight="bold" />
        </button>
        <span className="min-w-10 text-center text-sm font-bold tabular-nums" aria-live="polite">
          {stock}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() => send({ onHand: stock + 1 }, "Stock updated.")}
          aria-label="Increase stock by one"
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/80 text-muted-foreground hover:text-foreground hover:border-foreground disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" weight="bold" />
        </button>
      </div>
      {typeof active === "boolean" ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => send({ active: !active }, active ? "Taken offline." : "Live on the store.")}
          className="text-xs font-bold text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          {active ? "Take offline" : "Put live"}
        </button>
      ) : null}
    </div>
  )
}

function ProductsPage() {
  const qc = useQueryClient()
  const [offset, setOffset] = useState(0)
  const { data, isLoading, isError } = useProducts({ limit: PAGE_SIZE, offset })
  const { data: categoriesData } = useCategories()
  const propose = useProposeProduct()
  const updateVariant = useUpdateVariant()

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
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

  // Filter products by search, status, and the seller's own categories.
  const filteredProducts = useMemo(() => {
    return allProducts.filter((p) => {
      const matchesSearch =
        search.trim() === "" ||
        (p.title || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.handle || "").toLowerCase().includes(search.toLowerCase())

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "draft" ? p.status === "draft" || !p.status : p.status === statusFilter)

      const matchesCategory =
        categoryFilter === "all" ||
        (p.categories ?? []).some((c) => c.id === categoryFilter)

      return matchesSearch && matchesStatus && matchesCategory
    })
  }, [allProducts, search, statusFilter, categoryFilter])

  // The seller's own category shelf: id, name, live count. Switching swaps
  // the grid — publish/stock decisions happen per category, not in a pile.
  const sellerCategories = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; count: number }>()
    for (const p of allProducts) {
      for (const c of p.categories ?? []) {
        const name = categoryNameOf(c.id) ?? c.id
        const entry = seen.get(c.id) ?? { id: c.id, name, count: 0 }
        entry.count += 1
        seen.set(c.id, entry)
      }
    }
    return [...seen.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  }, [allProducts, categories])

  const getStatusBadge = (status: string, product?: Record<string, unknown>) => {
    switch (status) {
      case "published":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-ink text-white shadow-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-current" /> Live
          </span>
        )
      case "proposed":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-primary text-primary-foreground shadow-xs">
            <Clock className="h-3 w-3" weight="bold" /> In Review
          </span>
        )
      case "rejected": {
        const meta = product?.metadata as Record<string, unknown> | undefined
        const alk = meta?.alkemart as Record<string, unknown> | undefined
        const mod = alk?.moderation as Record<string, unknown> | undefined
        const reason = mod?.reason as string | undefined
        return (
          <Badge tone="danger" emphasis="solid" size="sm" className="group relative cursor-help" title={reason || "Rejected"}>
            <WarningCircle className="h-3 w-3" weight="bold" />
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
        return (
          <Badge tone="neutral" emphasis="outline" size="sm">
            Draft
          </Badge>
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
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">Catalog &amp; Inventory</h1>
              <p className="text-sm font-bold text-muted-foreground mt-0.5">
                {stats.total} {stats.total === 1 ? "Listing" : "Listings"}
              </p>
            </div>
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
          <Button size="default" className="w-full sm:w-auto gap-2 shadow-sm font-bold px-5 rounded-lg">
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
              { id: "all", label: "All Items", count: stats.total },
              { id: "published", label: "Live on Store", count: stats.published },
              { id: "proposed", label: "In Review", count: stats.inReview },
              { id: "draft", label: "Drafts", count: stats.drafts + stats.rejected },
            ].map((tab) => {
              const isSelected = statusFilter === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  aria-pressed={isSelected}
                  className={`group text-left p-4 rounded-lg border cursor-pointer flex flex-col justify-between gap-2 ${
                    isSelected
                      ? "bg-card border-foreground shadow-xs"
                      : "bg-card/70 hover:bg-card border-border/80"
                  }`}
                >
                  <span className={`text-xs font-bold uppercase tracking-wider ${
                    isSelected ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                  }`}>
                    {tab.label}
                  </span>

                  <span className={`text-2xl sm:text-3xl font-black tabular-nums tracking-tight ${
                    isSelected ? "text-foreground" : "text-foreground/80"
                  }`}>
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* ── Own-category shelf switcher: text tabs, no pills. Selecting
              narrows the grid (and table) to that shelf for stock/publish
              decisions. Hidden when the seller has a single shelf. */}
          {sellerCategories.length > 1 ? (
            <div className="flex items-center gap-1 overflow-x-auto border-b border-border/60" role="tablist" aria-label="Filter by category">
              {[{ id: "all", name: "All", count: allProducts.length }, ...sellerCategories].map((c) => {
                const selected = categoryFilter === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setCategoryFilter(c.id)}
                    className={`shrink-0 px-3 py-2 text-sm font-bold border-b-2 -mb-px cursor-pointer ${
                      selected
                        ? "border-foreground text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {c.name}
                    <span className="ml-1.5 font-semibold text-muted-foreground tabular-nums">{c.count}</span>
                  </button>
                )
              })}
            </div>
          ) : null}

          {/* ── Spacious Horizontal Search & Controls Section ── */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2 rounded-lg border border-border/80 bg-card/60 shadow-2xs">
            <div className="relative flex-1">
              <MagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-10.5 text-sm bg-background border-border/70 focus:border-primary rounded-lg w-full"
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

              <div className="inline-flex rounded-lg border border-border/80 p-1 bg-muted/30">
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
        <Card className="p-8 text-center border border-destructive/20 shadow-xs rounded-lg">
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
            <Card key={i} className="h-80 bg-muted/40 border-border/60 rounded-lg" />
          ))}
        </div>
      ) : allProducts.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-14 text-center border-dashed border-2 shadow-xs bg-muted/10 rounded-lg">
          <div className="h-16 w-16 bg-muted text-primary rounded-lg flex items-center justify-center mb-4 shadow-inner">
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
        <Card className="p-12 text-center shadow-xs rounded-lg">
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

            return (
              <div
                key={product.id}
                className="group relative flex flex-col rounded-lg border border-border/80 bg-card overflow-hidden"
              >
                {/* Media Showcase Frame with Status & Storefront Link */}
                <div className="aspect-[16/10] bg-white relative overflow-hidden">
                  {product.thumbnail ? (
                    <img
                      src={product.thumbnail}
                      alt={product.title || "Product"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/30">
                      <Package className="h-10 w-10 stroke-[1.5]" />
                      <span className="text-xs font-semibold mt-1">No Image</span>
                    </div>
                  )}

                  {/* Status Overlay */}
                  <div className="absolute top-3 right-3 z-10">
                    {getStatusBadge(product.status || "draft", product)}
                  </div>
                </div>

                {/* Card Body — title, price, stock, action. Category lives in
                    navigation and filters; internal refs live on the detail
                    page. Nothing machine-stamped on the card. */}
                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-base text-foreground line-clamp-1 tracking-tight" title={product.title || "Untitled"}>
                      {product.title || "Untitled"}
                    </h3>
                  </div>

                  {/* Price & Stock Commercial Specs */}
                  <div className="flex items-end justify-between pt-3 border-t border-border/60">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Selling Price</p>
                      <p className="text-xl font-black text-foreground whitespace-nowrap tabular-nums">
                        {price > 0 ? `GH₵ ${price.toFixed(2)}` : "—"}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Inventory</p>
                      {stock !== null ? (
                        <p className={`text-sm font-bold tabular-nums whitespace-nowrap ${
                          stock > 0 ? "text-foreground" : "text-tone-danger-ink"
                        }`}>
                          {stock > 0 ? `${stock} in stock` : "Out of stock"}
                        </p>
                      ) : (
                        <span className="text-xs text-muted-foreground font-medium">Standard</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="p-3 bg-muted/15 border-t border-border/60 space-y-2">
                  <QuickStockRow
                    productId={product.id}
                    variantId={product.variants?.[0]?.id ?? null}
                    stock={typeof product.metadata?.onHand === "number" ? product.metadata.onHand : null}
                    active={product.combos?.[0]?.active}
                  />
                  <div className="flex items-center gap-2">
                    <Link to="/products/$id" params={{ id: product.id }} className="flex-1">
                      <Button className="w-full gap-1.5 h-8.5 text-xs font-bold rounded-lg" size="sm" variant="outline">
                        <PencilSimple className="h-3.5 w-3.5 text-primary" />
                        Manage Listing
                      </Button>
                    </Link>

                    {product.status === "draft" && (
                      <Button
                        size="sm"
                        className="h-8.5 text-xs font-semibold gap-1 rounded-lg"
                        onClick={() => handlePropose(product.id)}
                        isLoading={propose.isPending && propose.variables === product.id}
                      >
                        Submit
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Quick-Add Companion Card when catalog has few items to balance layout */}
          {filteredProducts.length <= 2 && statusFilter === "all" && search === "" && (
            <Link
              to="/quick-sell"
              className="group relative flex flex-col items-center justify-center p-8 rounded-lg border-2 border-dashed border-border/80 hover:border-primary bg-muted/10 hover:bg-muted/20 min-h-[320px] text-center"
            >
              <div className="h-12 w-12 rounded-lg bg-muted text-primary flex items-center justify-center mb-3">
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
        <Card className="overflow-hidden shadow-2xs rounded-lg border">
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
                      <div className="h-11 w-11 rounded-lg overflow-hidden bg-muted/60 border border-border/60 flex items-center justify-center">
                        {product.thumbnail ? (
                          <img src={product.thumbnail} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Package className="h-5 w-5 text-muted-foreground/40" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link to="/products/$id" params={{ id: product.id }} className="font-bold text-sm hover:text-primary line-clamp-1">
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
                        <span className={`text-sm font-bold tabular-nums whitespace-nowrap ${
                          stock > 0 ? "text-foreground" : "text-tone-danger-ink"
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
