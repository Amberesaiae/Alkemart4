import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useProduct, useUpdateProduct, useDeleteProduct, useCategories, useProposeProduct, useUploadImage } from "../../lib/hooks"
import { type ProductStatus, products as productsApi } from "../../lib/api"
import { Card, Button, Input, Label, Textarea, Select, Skeleton } from "@workspace/ui"
import { ArrowLeft, FloppyDisk, Trash, WarningCircle, Clock, PaperPlaneTilt, CaretDown, CaretUp, Tag } from "@phosphor-icons/react"
import { PageShell } from "../../components/page-shell"
import { toast } from "sonner"

export const Route = createFileRoute('/products/$id')({
  component: ProductDetailPage,
})

interface ProductFormData {
  title: string
  description: string
  categoryId: string
  imageUrl: string
}

function ProductDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data, isLoading, isError } = useProduct(id)
  const update = useUpdateProduct()
  const upload = useUploadImage()
  const del = useDeleteProduct()
  const propose = useProposeProduct()
  const { data: categoriesData } = useCategories()

  const [editing, setEditing] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [appealMessage, setAppealMessage] = useState("")
  const [appealOpen, setAppealOpen] = useState(false)

  const handleAppeal = async () => {
    if (!appealMessage.trim()) {
      toast.error("Tell the ops team why this should be reviewed again.")
      return
    }
    try {
      await productsApi.appeal(id, appealMessage.trim())
      toast.success("Appeal sent — the ops team will review it.")
      setAppealMessage("")
      setAppealOpen(false)
      qc.invalidateQueries({ queryKey: ["vendor", "appeals", id] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send appeal.")
    }
  }
  const [form, setForm] = useState<ProductFormData>({ title: "", description: "", categoryId: "", imageUrl: "" })
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Pricing & stock editing state (single Workers offer, from product data)
  const [offerFormOpen, setOfferFormOpen] = useState(false)
  const [priceGhs, setPriceGhs] = useState("")
  const [stockQty, setStockQty] = useState("")
  const [savingOffers, setSavingOffers] = useState(false)

  const product = data?.product
  const meta = product?.metadata as Record<string, unknown> | undefined
  const alkemartMeta = meta?.alkemart as Record<string, unknown> | undefined
  const moderation = alkemartMeta?.moderation as Record<string, unknown> | undefined
  const rejectionReason = product?.status === "rejected" ? (moderation?.reason as string | undefined) : undefined
  const changesRequestedReason = moderation?.action === "changes_requested" ? (moderation?.reason as string | undefined) : undefined

  // Single Workers offer, read off the product itself (major GHS units).
  const currentPriceGhs = product?.variants?.[0]?.prices?.[0]?.amount ?? 0
  const currentStock = typeof product?.metadata?.onHand === "number" ? (product.metadata.onHand as number) : 0

  const { data: appealsData } = useQuery({
    queryKey: ["vendor", "appeals", id],
    queryFn: () => productsApi.appealsMine(),
    enabled: product?.status === "rejected",
    staleTime: 30_000,
  })
  const openAppeal = (appealsData?.appeals ?? []).find(a => a.productId === id && a.status === "open")
  const closedAppeal = (appealsData?.appeals ?? []).filter(a => a.productId === id && a.status === "closed").slice(-1)[0]

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
      imageUrl: product.thumbnail || "",
    })
    setEditing(true)
  }

  const handlePhotoPick = async (file: File | undefined) => {
    if (!file) return
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
      toast.error("Only PNG, JPG, WebP, or GIF images are accepted.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5 MB.")
      return
    }
    setUploadingPhoto(true)
    try {
      const url = await upload.mutateAsync(file)
      setForm(p => ({ ...p, imageUrl: url }))
      toast.success("Photo uploaded — save to apply it.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Photo upload failed.")
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleSave = async () => {
    if (!form.title || form.title.trim().length < 3) {
      toast.error("Title must be at least 3 characters.")
      return
    }
    const imageUrl = form.imageUrl.trim()
    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
      toast.error("Image URL must start with http:// or https://")
      return
    }
    try {
      const wasPublished = product?.status === "published"
      const res = await update.mutateAsync({
        id,
        data: {
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          categories: form.categoryId ? [{ id: form.categoryId }] : [],
          ...(imageUrl ? { thumbnail: imageUrl } : {}),
        },
      })
      if (wasPublished && res.product.status === "proposed") {
        toast.success("Saved — sent back for review.")
      } else {
        toast.success("Product updated.")
      }
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

  // Start editing pricing: pre-fill form with current values
  const startOfferEditing = () => {
    setPriceGhs(currentPriceGhs > 0 ? String(currentPriceGhs.toFixed(2)) : "")
    setStockQty("")
    setOfferFormOpen(true)
  }

  const handleSaveOffers = async () => {
    const patch: { pricePesewas?: string; onHand?: number } = {}
    const priceRaw = priceGhs.trim()
    if (priceRaw !== "") {
      const price = parseFloat(priceRaw)
      if (isNaN(price) || price <= 0) {
        toast.error("Enter a valid price above GH₵0. Nothing was saved.")
        return
      }
      if (price !== currentPriceGhs) patch.pricePesewas = String(Math.round(price * 100))
    }
    const stockRaw = stockQty.trim()
    if (stockRaw !== "") {
      const qty = Number(stockRaw)
      if (!Number.isInteger(qty) || qty < 0) {
        toast.error("Stock must be a whole number of 0 or more. Nothing was saved.")
        return
      }
      if (qty !== currentStock) patch.onHand = qty
    }
    if (Object.keys(patch).length === 0) {
      toast.info("No changes to save.")
      return
    }
    setSavingOffers(true)
    try {
      await update.mutateAsync({ id, data: patch })
      toast.success("Pricing & stock updated.")
      setOfferFormOpen(false)
      qc.invalidateQueries({ queryKey: ["vendor", "products", id] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update pricing.")
    } finally {
      setSavingOffers(false)
    }
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
          <WarningCircle className="h-10 w-10 mx-auto mb-3 text-destructive" />
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
      proposed: "bg-warning/10 text-warning-fg",
      published: "bg-success/10 text-success",
      rejected: "bg-destructive/10 text-destructive",
    }
    return (
      <span className={`px-2.5 py-0.5 rounded-md border text-xs font-semibold ${map[status] || "bg-muted border-border"}`}>
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
            <WarningCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-sm text-destructive mb-1">Product Rejected</h3>
              <p className="text-sm text-destructive/90">{rejectionReason}</p>
              <p className="text-xs text-destructive/60 mt-2">Edit the product to address the feedback, then re-submit for review — or appeal below.</p>
              {openAppeal ? (
                <p className="text-sm font-semibold text-foreground mt-3" role="status">
                  Appeal pending review.
                </p>
              ) : closedAppeal ? (
                <p className="text-sm text-muted-foreground mt-3">
                  Last appeal {closedAppeal.decision === "reopened" ? "reopened this listing" : "was upheld"}
                  {closedAppeal.response ? ` — “${closedAppeal.response}”` : "."}
                </p>
              ) : appealOpen ? (
                <div className="mt-3 space-y-2">
                  <Textarea
                    placeholder="Why should this be reviewed again?"
                    value={appealMessage}
                    onChange={e => setAppealMessage(e.target.value)}
                    className="h-24 bg-card"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => { void handleAppeal() }}>
                      Send appeal
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setAppealOpen(false); setAppealMessage("") }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="outline" className="mt-3" onClick={() => setAppealOpen(true)}>
                  Appeal this decision
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {changesRequestedReason && !rejectionReason && (
        <div className="mb-4 p-4 bg-warning/10 border border-warning/20 rounded-xl">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-warning-fg shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-sm text-warning-fg mb-1">Changes Requested</h3>
              <p className="text-sm text-warning-fg/90">{changesRequestedReason}</p>
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
                  <PaperPlaneTilt className="h-4 w-4" />
                  Re-submit
                </Button>
              )}
              {product.status !== "published" && !confirmDelete ? (
                  <Button onClick={() => setConfirmDelete(true)} variant="outline" size="sm" className="text-destructive border-destructive/30">
                    <Trash className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                ) : product.status !== "published" ? (
                  <div className="flex gap-2 items-center">
                    <span className="text-xs text-destructive font-semibold">Sure?</span>
                    <Button onClick={handleDelete} size="sm" variant="destructive" isLoading={del.isPending}>
                      Confirm
                    </Button>
                    <Button onClick={() => setConfirmDelete(false)} size="sm" variant="outline">
                      Cancel
                    </Button>
                  </div>
                ) : null}
              </div>
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
              <div className="space-y-2">
                <Label htmlFor="edit-image">Photo</Label>
                {form.imageUrl ? (
                  <div className="flex items-center gap-3">
                    <img src={form.imageUrl} alt="Product preview" className="h-20 w-20 rounded-xl object-cover ring-1 ring-border" />
                    <Button variant="outline" size="sm" onClick={() => setForm(p => ({ ...p, imageUrl: "" }))}>
                      Remove
                    </Button>
                  </div>
                ) : null}
                <Input
                  id="edit-image-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  disabled={uploadingPhoto}
                  onChange={e => { void handlePhotoPick(e.target.files?.[0]); e.target.value = "" }}
                />
                <p className="text-xs text-muted-foreground">
                  {uploadingPhoto ? "Uploading…" : "Upload a photo — stored as WebP automatically."}
                </p>
                <Input
                  id="edit-image"
                  type="url"
                  placeholder="…or paste a photo link (https://)"
                  value={form.imageUrl}
                  onChange={e => setForm(p => ({ ...p, imageUrl: e.target.value }))}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button onClick={handleSave} isLoading={update.isPending} className="gap-2">
                  <FloppyDisk className="h-4 w-4" />
                  Save Changes
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
      <Card className="shadow-sm">
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
              {!offerFormOpen && (
                <p className="text-sm text-muted-foreground font-medium">
                  GH₵ {currentPriceGhs.toFixed(2)} · {currentStock} in stock
                </p>
              )}
            </div>
          </div>
          {offerFormOpen ? <CaretUp className="h-5 w-5 text-muted-foreground" /> : <CaretDown className="h-5 w-5 text-muted-foreground" />}
        </button>

        {offerFormOpen && (
          <div className="px-5 pb-5 pt-0 border-t border-border space-y-4">
            <div className="pt-4 flex items-end gap-4 p-3 bg-muted/30 rounded-lg border border-border/50">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                  Price (GHS)
                </Label>
                <div className="relative flex-1 max-w-[160px]">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground select-none">
                    GH₵
                  </span>
                  <Input
                    type="number"
                    className="pl-14 h-10"
                    placeholder={currentPriceGhs > 0 ? String(currentPriceGhs.toFixed(2)) : "0.00"}
                    value={priceGhs}
                    onChange={e => setPriceGhs(e.target.value)}
                    min="0"
                    step="0.01"
                  />
                </div>
                {currentPriceGhs > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Current: GH₵ {currentPriceGhs.toFixed(2)}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                  Stock
                </Label>
                <Input
                  type="number"
                  className="h-10 w-[110px]"
                  placeholder={String(currentStock)}
                  value={stockQty}
                  onChange={e => setStockQty(e.target.value)}
                  min="0"
                  step="1"
                  inputMode="numeric"
                  aria-label="Stock quantity"
                />
                <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                  Current: {currentStock} in stock
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => { void handleSaveOffers() }}
                isLoading={savingOffers}
                className="gap-2"
              >
                <FloppyDisk className="h-4 w-4" />
                Save Pricing &amp; Stock
              </Button>
              <Button onClick={() => setOfferFormOpen(false)} variant="outline">
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>
    </PageShell>
  )
}
