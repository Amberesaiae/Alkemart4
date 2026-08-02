import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useProduct, useUpdateProduct, useDeleteProduct, useCategories, useProposeProduct, useProductOffers, useUpdateOffer, useOfferStockLevels } from "../lib/hooks"
import { type ProductStatus, inventoryItems } from "../lib/api"
import { Card, Button, Input, Label, Textarea, Select, Skeleton } from "@workspace/ui"
import { ArrowLeft, Save, Trash2, AlertCircle, Clock, SendHorizonal, ChevronDown, ChevronUp, Tag } from "lucide-react"
import { PageShell } from "../components/page-shell"
import { toast } from "sonner"

export const Route = createFileRoute('/products/$id')({
  component: ProductDetailPage,
})

interface ProductFormData {
  title: string
  description: string
  categoryId: string
}

type OfferPriceForm = Record<string, { priceGhs: string; stock: string }>

/** Stock quantity editor for one offer — shows current level, lets vendor type a new one. */
function OfferStockInput({
  inventoryItemId,
  value,
  onChange,
}: {
  inventoryItemId?: string
  value: string
  onChange: (v: string) => void
}) {
  const { data, isLoading } = useOfferStockLevels(inventoryItemId)
  const level = data?.inventory_levels?.[0]

  if (!inventoryItemId) return null

  return (
    <div className="relative w-[110px]">
      <Input
        type="number"
        className="h-10"
        placeholder={
          isLoading ? "…" : level ? String(level.stocked_quantity) : "0"
        }
        value={value}
        onChange={e => onChange(e.target.value)}
        min="0"
        step="1"
        inputMode="numeric"
        aria-label="Stock quantity"
      />
      <span className="absolute -bottom-4 left-0 text-[10px] text-muted-foreground whitespace-nowrap">
        {level ? `Current: ${level.stocked_quantity} in stock` : isLoading ? "Loading stock…" : "No stock record"}
      </span>
    </div>
  )
}

function ProductDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data, isLoading, isError } = useProduct(id)
  const { data: offersData, isLoading: offersLoading } = useProductOffers(id)
  const update = useUpdateProduct()
  const updateOffer = useUpdateOffer()
  const del = useDeleteProduct()
  const propose = useProposeProduct()
  const { data: categoriesData } = useCategories()

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<ProductFormData>({ title: "", description: "", categoryId: "" })
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Offer / pricing editing state
  const [offerFormOpen, setOfferFormOpen] = useState(false)
  const [offerForm, setOfferForm] = useState<OfferPriceForm>({})
  const [savingOffers, setSavingOffers] = useState(false)

  const product = data?.product
  const meta = product?.metadata as Record<string, unknown> | undefined
  const alkemartMeta = meta?.alkemart as Record<string, unknown> | undefined
  const moderation = alkemartMeta?.moderation as Record<string, unknown> | undefined
  const rejectionReason = product?.status === "rejected" ? (moderation?.reason as string | undefined) : undefined
  const changesRequestedReason = moderation?.action === "changes_requested" ? (moderation?.reason as string | undefined) : undefined

  const offers = offersData?.offers || []

  const handleReSubmit = async () => {
    try {
      await propose.mutateAsync(id)
      toast.success("Product re-submitted for review.")
      qc.invalidateQueries({ queryKey: ["vendor", "products", id] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to re-submit.")
    }
  }

  const startEditing = () => {
    if (!product) return
    setForm({
      title: product.title || "",
      description: product.description || "",
      categoryId: product.categories?.[0]?.id || "",
    })
    setEditing(true)
  }

  const handleSave = async () => {
    if (!form.title || form.title.trim().length < 3) {
      toast.error("Title must be at least 3 characters.")
      return
    }
    try {
      await update.mutateAsync({
        id,
        data: {
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          categories: form.categoryId ? [{ id: form.categoryId }] : [],
        },
      })
      toast.success("Product updated.")
      setEditing(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update.")
    }
  }

  const handleDelete = async () => {
    try {
      await del.mutateAsync(id)
      navigate({ to: "/products" })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete.")
      setConfirmDelete(false)
    }
  }

  // Start editing offers: pre-fill form with current prices
  const startOfferEditing = () => {
    const initial: OfferPriceForm = {}
    for (const offer of offers) {
      const priceAmountPesewas = offer.prices?.find(p => p.currency_code === "ghs")?.amount
        ?? offer.prices?.[0]?.amount
        ?? 0
      initial[offer.id] = { priceGhs: priceAmountPesewas > 0 ? String((priceAmountPesewas / 100).toFixed(2)) : "", stock: "" }
    }
    setOfferForm(initial)
    setOfferFormOpen(true)
  }

  const handleSaveOffers = async () => {
    setSavingOffers(true)
    let hasError = false
    for (const [offerId, val] of Object.entries(offerForm)) {
      const priceGhs = parseFloat(val.priceGhs)
      if (!isNaN(priceGhs) && priceGhs > 0) {
        try {
          await updateOffer.mutateAsync({
            id: offerId,
            input: { prices: [{ amount: Math.round(priceGhs * 100), currency_code: "ghs" }] },
          })
        } catch (err) {
          toast.error(`Failed to update offer price: ${err instanceof Error ? err.message : "Unknown error"}`)
          hasError = true
        }
      }

      // Stock update — only when the vendor typed a value
      const stockRaw = val.stock.trim()
      if (stockRaw !== "") {
        const stockQty = Number(stockRaw)
        if (!Number.isInteger(stockQty) || stockQty < 0) {
          toast.error("Stock must be a whole number of 0 or more.")
          hasError = true
          continue
        }
        const offer = offers.find(o => o.id === offerId)
        const invItemId = offer?.inventory_items?.[0]?.inventory_item_id
        if (!invItemId) {
          toast.error("This offer has no inventory record — stock cannot be updated.")
          hasError = true
          continue
        }
        try {
          const { inventory_levels } = await inventoryItems.levels(invItemId)
          const level = inventory_levels?.[0]
          if (!level) {
            toast.error("No stock location found for this offer.")
            hasError = true
            continue
          }
          await inventoryItems.setLevel(invItemId, level.location_id, stockQty)
          qc.invalidateQueries({ queryKey: ["vendor", "stock-levels", invItemId] })
        } catch (err) {
          toast.error(`Failed to update stock: ${err instanceof Error ? err.message : "Unknown error"}`)
          hasError = true
        }
      }
    }
    setSavingOffers(false)
    if (!hasError) {
      toast.success("Pricing & stock updated.")
      setOfferFormOpen(false)
      qc.invalidateQueries({ queryKey: ["vendor", "offers", id] })
    }
  }

  const getVariantTitle = (offer: { variant_id?: string }) => {
    if (!offer.variant_id || !product?.variants) return "Default"
    return product.variants.find(v => v.id === offer.variant_id)?.title || "Variant"
  }

  if (isLoading) {
    return (
      <PageShell>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </PageShell>
    )
  }

  if (isError || !product) {
    return (
      <PageShell>
        <Card className="p-8 text-center">
          <AlertCircle className="h-10 w-10 mx-auto mb-3 text-destructive" />
          <h2 className="text-lg font-bold mb-1">Product not found</h2>
          <p className="text-muted-foreground text-sm mb-4">
            This product doesn't exist or you don't have access to it.
          </p>
          <Button onClick={() => navigate({ to: "/products" })} variant="outline">
            Back to Products
          </Button>
        </Card>
      </PageShell>
    )
  }

  const statusBadge = (status: ProductStatus) => {
    const map: Record<ProductStatus, string> = {
      draft: "bg-muted text-muted-foreground",
      proposed: "bg-warning/10 text-warning",
      published: "bg-success/10 text-success",
      rejected: "bg-destructive/10 text-destructive",
    }
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold ${map[status] || "bg-muted"}`}>
        {status === "proposed" ? "In Review" : status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  return (
    <PageShell>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/products" })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{product.title || "Untitled"}</h1>
          <p className="text-sm text-muted-foreground">Ref: {product.handle?.slice(0, 12) || product.id.slice(0, 12)}</p>
        </div>
      </div>

      {rejectionReason && (
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-sm text-destructive mb-1">Product Rejected</h3>
              <p className="text-sm text-destructive/90">{rejectionReason}</p>
              <p className="text-xs text-destructive/60 mt-2">Edit the product to address the feedback, then re-submit for review.</p>
            </div>
          </div>
        </div>
      )}

      {changesRequestedReason && !rejectionReason && (
        <div className="mb-4 p-4 bg-warning/10 border border-warning/20 rounded-xl">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-sm text-warning mb-1">Changes Requested</h3>
              <p className="text-sm text-warning/90">{changesRequestedReason}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1 overflow-hidden">
          {product.thumbnail ? (
            <img src={product.thumbnail} alt={product.title || "Product"} className="w-full aspect-square object-cover" />
          ) : (
            <div className="w-full aspect-square bg-muted flex items-center justify-center text-muted-foreground text-sm font-semibold">
              No Image
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-muted-foreground">Status:</span>
              {statusBadge(product.status || "draft")}
            </div>
            {product.status !== "published" && (
              <div className="flex gap-2">
                {!editing && (
                  <Button onClick={startEditing} variant="outline" size="sm">
                    Edit
                  </Button>
                )}
                {product.status === "rejected" && (
                  <Button
                    size="sm"
                    className="gap-1"
                    onClick={handleReSubmit}
                    isLoading={propose.isPending}
                  >
                    <SendHorizonal className="h-4 w-4" />
                    Re-submit
                  </Button>
                )}
                {!confirmDelete ? (
                  <Button onClick={() => setConfirmDelete(true)} variant="outline" size="sm" className="text-destructive border-destructive/30">
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                ) : (
                  <div className="flex gap-2 items-center">
                    <span className="text-xs text-destructive font-semibold">Sure?</span>
                    <Button onClick={handleDelete} size="sm" variant="destructive" isLoading={del.isPending}>
                      Confirm
                    </Button>
                    <Button onClick={() => setConfirmDelete(false)} size="sm" variant="outline">
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {editing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input id="edit-title" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-desc">Description</Label>
                <Textarea id="edit-desc" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={4} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-category">Category</Label>
                <Select id="edit-category" value={form.categoryId} onChange={e => setForm(p => ({ ...p, categoryId: e.target.value }))}>
                  <option value="">No category</option>
                  {categoriesData?.product_categories?.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </Select>
              </div>
              <div className="flex gap-3 pt-2">
                <Button onClick={handleSave} isLoading={update.isPending} className="gap-2">
                  <Save className="h-4 w-4" />
                  Save
                </Button>
                <Button onClick={() => setEditing(false)} variant="outline">Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <span className="text-sm font-semibold text-muted-foreground block mb-1">Title</span>
                <p className="font-bold text-lg">{product.title || "Untitled"}</p>
              </div>
              <div>
                <span className="text-sm font-semibold text-muted-foreground block mb-1">Description</span>
                <p className="text-sm whitespace-pre-wrap">{product.description || "No description."}</p>
              </div>
              {product.categories && product.categories.length > 0 && (
                <div>
                  <span className="text-sm font-semibold text-muted-foreground block mb-1">Category</span>
                  <p className="text-sm">{product.categories.map(c => c.name).join(", ")}</p>
                </div>
              )}
              <div>
                <span className="text-sm font-semibold text-muted-foreground block mb-1">Created</span>
                <p className="text-sm">{product.created_at ? new Date(product.created_at).toLocaleDateString() : "Unknown"}</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ── Inventory & Pricing ── */}
      <Card className="border-2">
        <button
          type="button"
          className="w-full flex items-center justify-between p-5 text-left"
          onClick={() => {
            if (!offerFormOpen) startOfferEditing()
            else setOfferFormOpen(false)
          }}
        >
          <div className="flex items-center gap-3">
            <Tag className="h-5 w-5 text-muted-foreground" />
            <div>
              <h3 className="font-bold text-base">Inventory &amp; Pricing</h3>
              {!offerFormOpen && offers.length > 0 && (
                <p className="text-sm text-muted-foreground font-medium">
                  {offers.length} offer{offers.length > 1 ? "s" : ""} · GH₵{" "}
                  {((offers[0].prices?.find(p => p.currency_code === "ghs")?.amount ?? 0) / 100).toFixed(2)}
                  {offers.length > 1 ? " – ..." : ""}
                </p>
              )}
            </div>
          </div>
          {offerFormOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
        </button>

        {offerFormOpen && (
          <div className="px-5 pb-5 pt-0 border-t border-border space-y-4">
            {offersLoading ? (
              <div className="space-y-3 pt-4">
                {[1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : offers.length === 0 ? (
              <div className="pt-4 text-center py-8">
                <p className="text-sm text-muted-foreground font-medium">
                  No offers yet. Use <strong>Quick Sell</strong> to list this product with a price.
                </p>
              </div>
            ) : (
              <div className="pt-4 space-y-4">
                {offers.map(offer => {
                  const currentPricePesewas = offer.prices?.find(p => p.currency_code === "ghs")?.amount
                    ?? offer.prices?.[0]?.amount ?? 0

                  return (
                    <div key={offer.id} className="flex items-end gap-4 p-3 bg-muted/30 rounded-lg border border-border/50">
                      <div className="flex-1 space-y-1.5">
                        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                          {getVariantTitle(offer)}
                        </Label>
                        <div className="flex items-center gap-3">
                          <div className="relative flex-1 max-w-[160px]">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground select-none">
                              GH₵
                            </span>
                            <Input
                              type="number"
                              className="pl-14 h-10"
                              placeholder={currentPricePesewas > 0 ? String((currentPricePesewas / 100).toFixed(2)) : "0.00"}
                              value={offerForm[offer.id]?.priceGhs ?? ""}
                              onChange={e => setOfferForm(f => ({ ...f, [offer.id]: { ...(f[offer.id] ?? { priceGhs: "", stock: "" }), priceGhs: e.target.value } }))}
                              min="0"
                              step="0.01"
                            />
                          </div>
                          <OfferStockInput
                            inventoryItemId={offer.inventory_items?.[0]?.inventory_item_id}
                            value={offerForm[offer.id]?.stock ?? ""}
                            onChange={v => setOfferForm(f => ({ ...f, [offer.id]: { ...(f[offer.id] ?? { priceGhs: "", stock: "" }), stock: v } }))}
                          />
                        </div>
                        {currentPricePesewas > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Current: GH₵ {(currentPricePesewas / 100).toFixed(2)}
                          </p>
                        )}
                      </div>
                      {offer.sku && (
                        <div className="shrink-0 text-right">
                          <p className="text-xs text-muted-foreground">SKU</p>
                          <p className="text-xs font-mono font-bold">{offer.sku}</p>
                        </div>
                      )}
                    </div>
                  )
                })}

                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={handleSaveOffers}
                    isLoading={savingOffers}
                    className="gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Save Prices
                  </Button>
                  <Button onClick={() => setOfferFormOpen(false)} variant="outline">
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </PageShell>
  )
}
