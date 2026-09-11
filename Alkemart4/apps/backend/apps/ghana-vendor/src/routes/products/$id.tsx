import { createFileRoute, useNavigate, Link } from "@tanstack/react-router"
import { useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useProduct, useUpdateProduct, useDeleteProduct, useCategories, useProposeProduct, useUploadImage } from "../../lib/hooks"
import { type ProductStatus, products as productsApi } from "../../lib/api"
import { Card, Button, Input, Label, Textarea, Select, Skeleton, Badge } from "@workspace/ui"
import {
  ArrowLeft,
  FloppyDisk,
  Trash,
  WarningCircle,
  Clock,
  PaperPlaneTilt,
  PencilSimple,
  ArrowSquareOut,
  UploadSimple,
  CheckCircle,
  Package,
  CurrencyCircleDollar,
  X,
  Tag,
} from "@phosphor-icons/react"
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
  priceGhs: string
  stockQty: string
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

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [appealMessage, setAppealMessage] = useState("")
  const [appealOpen, setAppealOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showUrlInput, setShowUrlInput] = useState(false)

  // Quick pricing modal/drawer state
  const [quickOfferOpen, setQuickOfferOpen] = useState(false)
  const [quickPrice, setQuickPrice] = useState("")
  const [quickStock, setQuickStock] = useState("")
  const [savingQuickOffers, setSavingQuickOffers] = useState(false)

  const product = data?.product
  const meta = product?.metadata as Record<string, unknown> | undefined
  const alkemartMeta = meta?.alkemart as Record<string, unknown> | undefined
  const moderation = alkemartMeta?.moderation as Record<string, unknown> | undefined
  const rejectionReason = product?.status === "rejected" ? (moderation?.reason as string | undefined) : undefined
  const changesRequestedReason = moderation?.action === "changes_requested" ? (moderation?.reason as string | undefined) : undefined

  // Current values
  const currentPriceGhs = product?.variants?.[0]?.prices?.[0]?.amount ?? 0
  const currentStock = typeof product?.metadata?.onHand === "number" ? (product.metadata.onHand as number) : 0

  const [form, setForm] = useState<ProductFormData>({
    title: "",
    description: "",
    categoryId: "",
    imageUrl: "",
    priceGhs: "",
    stockQty: "",
  })

  const { data: appealsData } = useQuery({
    queryKey: ["vendor", "appeals", id],
    queryFn: () => productsApi.appealsMine(),
    enabled: product?.status === "rejected",
    staleTime: 30_000,
  })
  const openAppeal = (appealsData?.appeals ?? []).find(a => a.productId === id && a.status === "open")
  const closedAppeal = (appealsData?.appeals ?? []).filter(a => a.productId === id && a.status === "closed").slice(-1)[0]

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

  const handleReSubmit = async () => {
    try {
      await propose.mutateAsync(id)
      toast.success("Product submitted for review.")
      qc.invalidateQueries({ queryKey: ["vendor", "products", id] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit.")
    }
  }

  const startEditing = () => {
    if (!product) return
    setForm({
      title: product.title || "",
      description: product.description || "",
      categoryId: product.categories?.[0]?.id || "",
      imageUrl: product.thumbnail || "",
      priceGhs: currentPriceGhs > 0 ? String(currentPriceGhs) : "",
      stockQty: String(currentStock),
    })
    setShowUrlInput(false)
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
      toast.success("Photo uploaded successfully.")
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

    // Prepare patch
    const patch: {
      title: string
      description?: string
      categories?: { id: string }[]
      thumbnail?: string
      pricePesewas?: string
      onHand?: number
    } = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      categories: form.categoryId ? [{ id: form.categoryId }] : [],
      ...(imageUrl ? { thumbnail: imageUrl } : {}),
    }

    const priceRaw = form.priceGhs.trim()
    if (priceRaw !== "") {
      const price = parseFloat(priceRaw)
      if (isNaN(price) || price < 0) {
        toast.error("Price must be a valid number.")
        return
      }
      patch.pricePesewas = String(Math.round(price * 100))
    }

    const stockRaw = form.stockQty.trim()
    if (stockRaw !== "") {
      const qty = Number(stockRaw)
      if (!Number.isInteger(qty) || qty < 0) {
        toast.error("Stock must be a whole number of 0 or more.")
        return
      }
      patch.onHand = qty
    }

    try {
      const wasPublished = product?.status === "published"
      const res = await update.mutateAsync({
        id,
        data: patch,
      })
      if (wasPublished && res.product.status === "proposed") {
        toast.success("Saved — sent back for moderation review.")
      } else {
        toast.success("Product updated successfully.")
      }
      setEditing(false)
      qc.invalidateQueries({ queryKey: ["vendor", "products", id] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update product.")
    }
  }

  const handleDelete = async () => {
    try {
      await del.mutateAsync(id)
      toast.success("Product deleted.")
      navigate({ to: "/products" })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete product.")
      setConfirmDelete(false)
    }
  }

  const handleSaveQuickOffers = async () => {
    const patch: { pricePesewas?: string; onHand?: number } = {}
    const priceRaw = quickPrice.trim()
    if (priceRaw !== "") {
      const price = parseFloat(priceRaw)
      if (isNaN(price) || price < 0) {
        toast.error("Enter a valid price.")
        return
      }
      patch.pricePesewas = String(Math.round(price * 100))
    }
    const stockRaw = quickStock.trim()
    if (stockRaw !== "") {
      const qty = Number(stockRaw)
      if (!Number.isInteger(qty) || qty < 0) {
        toast.error("Stock must be a whole number of 0 or more.")
        return
      }
      patch.onHand = qty
    }
    if (Object.keys(patch).length === 0) {
      toast.info("No changes to save.")
      return
    }
    setSavingQuickOffers(true)
    try {
      await update.mutateAsync({ id, data: patch })
      toast.success("Pricing & stock updated.")
      setQuickOfferOpen(false)
      qc.invalidateQueries({ queryKey: ["vendor", "products", id] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update pricing.")
    } finally {
      setSavingQuickOffers(false)
    }
  }

  const statusBadge = (status: ProductStatus) => {
    switch (status) {
      case "published":
        return (
          <Badge variant="success" className="gap-1 shadow-2xs font-semibold">
            <CheckCircle className="h-3 w-3" /> Published
          </Badge>
        )
      case "proposed":
        return (
          <Badge variant="warning" className="gap-1 shadow-2xs font-semibold">
            <Clock className="h-3 w-3" /> In Review
          </Badge>
        )
      case "rejected":
        return (
          <Badge variant="destructive" className="gap-1 shadow-2xs font-semibold">
            <WarningCircle className="h-3 w-3" /> Rejected
          </Badge>
        )
      default:
        return <Badge variant="secondary" className="gap-1 font-semibold">Draft</Badge>
    }
  }

  if (isLoading) {
    return (
      <PageShell>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Skeleton className="lg:col-span-4 h-80 rounded-2xl" />
            <Skeleton className="lg:col-span-8 h-96 rounded-2xl" />
          </div>
        </div>
      </PageShell>
    )
  }

  if (isError || !product) {
    return (
      <PageShell>
        <Card className="p-12 text-center max-w-lg mx-auto shadow-xs rounded-2xl">
          <WarningCircle className="h-12 w-12 mx-auto mb-3 text-destructive" />
          <h2 className="text-xl font-bold mb-1">Product not found</h2>
          <p className="text-muted-foreground text-sm mb-6">
            This product listing doesn't exist or you don't have permission to view it.
          </p>
          <Button onClick={() => navigate({ to: "/products" })} variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Products
          </Button>
        </Card>
      </PageShell>
    )
  }

  const displayImage = editing ? form.imageUrl : product.thumbnail
  const categoryName = categoriesData?.product_categories?.find(c => c.id === product.categories?.[0]?.id)?.name

  return (
    <PageShell>
      {/* Navigation Breadcrumb Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: "/products" })}
            className="h-8 px-2.5 rounded-xl border-border/80 text-xs font-semibold gap-1.5 hover:bg-muted"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-black text-foreground">{product.title || "Untitled Product"}</h1>
              {statusBadge(product.status || "draft")}
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              Ref: {product.handle || product.id}
            </p>
          </div>
        </div>

        {/* Top Header Actions */}
        <div className="flex items-center gap-2">
          {!editing ? (
            <>
              <Button onClick={startEditing} variant="default" size="sm" className="gap-1.5 font-bold shadow-xs">
                <PencilSimple className="h-4 w-4" /> Edit Product
              </Button>

              {product.status === "draft" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 font-semibold"
                  onClick={handleReSubmit}
                  isLoading={propose.isPending}
                >
                  <PaperPlaneTilt className="h-4 w-4" /> Submit for Review
                </Button>
              )}

              {product.status === "rejected" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 font-semibold"
                  onClick={handleReSubmit}
                  isLoading={propose.isPending}
                >
                  <PaperPlaneTilt className="h-4 w-4" /> Re-submit
                </Button>
              )}

              {product.status !== "published" && !confirmDelete ? (
                <Button
                  onClick={() => setConfirmDelete(true)}
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <Trash className="h-4 w-4" />
                </Button>
              ) : product.status !== "published" ? (
                <div className="flex gap-1.5 items-center bg-destructive/10 border border-destructive/30 p-1 rounded-xl">
                  <span className="text-xs text-destructive font-bold px-1">Delete?</span>
                  <Button onClick={handleDelete} size="sm" variant="destructive" isLoading={del.isPending} className="h-7 text-xs">
                    Confirm
                  </Button>
                  <Button onClick={() => setConfirmDelete(false)} size="sm" variant="outline" className="h-7 text-xs">
                    Cancel
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex gap-2">
              <Button onClick={handleSave} isLoading={update.isPending} className="gap-1.5 font-bold shadow-xs">
                <FloppyDisk className="h-4 w-4" /> Save Changes
              </Button>
              <Button onClick={() => setEditing(false)} variant="outline" size="sm">
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Moderation Alerts */}
      {rejectionReason && (
        <div className="p-4 bg-destructive/10 border-2 border-destructive/30 rounded-2xl">
          <div className="flex items-start gap-3">
            <WarningCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-sm text-destructive">Listing Needs Attention</h3>
              <p className="text-sm text-destructive/90 mt-0.5">{rejectionReason}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Address the reason above by updating your listing details or appeal to our ops team.
              </p>

              {openAppeal ? (
                <p className="text-xs font-bold text-primary mt-2 flex items-center gap-1.5">
                  <Clock className="h-4 w-4" /> Appeal submitted — review in progress.
                </p>
              ) : closedAppeal ? (
                <p className="text-xs text-muted-foreground mt-2">
                  Previous appeal decision: <strong>{closedAppeal.decision}</strong>
                  {closedAppeal.response ? ` — “${closedAppeal.response}”` : ""}
                </p>
              ) : appealOpen ? (
                <div className="mt-3 space-y-2 max-w-lg">
                  <Textarea
                    placeholder="Provide clarification for ops review..."
                    value={appealMessage}
                    onChange={e => setAppealMessage(e.target.value)}
                    rows={3}
                    className="text-xs"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => { void handleAppeal() }}>Send Appeal</Button>
                    <Button size="sm" variant="outline" onClick={() => { setAppealOpen(false); setAppealMessage("") }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="outline" className="mt-3 text-xs" onClick={() => setAppealOpen(true)}>
                  Appeal this decision
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {changesRequestedReason && !rejectionReason && (
        <div className="p-4 bg-warning/10 border border-warning/30 rounded-2xl">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-warning-fg shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-sm text-warning-fg">Changes Requested</h3>
              <p className="text-sm text-warning-fg/90 mt-0.5">{changesRequestedReason}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── Left Column: Media & Specs (never stretches awkwardly!) ── */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-5 self-start">
          {/* Main Image Card */}
          <Card className="overflow-hidden border border-border/80 shadow-xs rounded-2xl bg-card">
            <div className="aspect-square bg-muted/40 relative overflow-hidden flex items-center justify-center">
              {displayImage ? (
                <img
                  src={displayImage}
                  alt={product.title || "Product"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40">
                  <Package className="h-16 w-16 stroke-[1.5]" />
                  <span className="text-xs font-semibold mt-2">No Product Image</span>
                </div>
              )}

              <div className="absolute top-3 right-3">
                {statusBadge(product.status || "draft")}
              </div>
            </div>

            {/* Photo upload zone if editing */}
            {editing && (
              <div className="p-4 border-t border-border/60 space-y-3 bg-muted/10">
                <input
                  ref={fileInputRef}
                  id="edit-image-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  disabled={uploadingPhoto}
                  className="hidden"
                  onChange={e => { void handlePhotoPick(e.target.files?.[0]); e.target.value = "" }}
                />

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingPhoto}
                    onClick={() => fileInputRef.current?.click()}
                    isLoading={uploadingPhoto}
                    className="w-full gap-1.5 text-xs font-semibold"
                  >
                    <UploadSimple className="h-3.5 w-3.5" />
                    {form.imageUrl ? "Replace Photo" : "Upload Photo"}
                  </Button>

                  {form.imageUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setForm(p => ({ ...p, imageUrl: "" }))}
                      className="text-xs text-destructive hover:bg-destructive/10 px-2"
                    >
                      <Trash className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                {!showUrlInput ? (
                  <button
                    type="button"
                    onClick={() => setShowUrlInput(true)}
                    className="text-[11px] font-semibold text-primary hover:underline block text-center w-full"
                  >
                    Or paste direct image URL
                  </button>
                ) : (
                  <div className="space-y-1.5 pt-1">
                    <Input
                      id="edit-image-url"
                      type="url"
                      placeholder="https://example.com/image.webp"
                      value={form.imageUrl}
                      onChange={e => setForm(p => ({ ...p, imageUrl: e.target.value }))}
                      className="text-xs h-8"
                    />
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Marketplace Stats Card */}
          <Card className="p-5 space-y-4 border border-border/80 shadow-2xs rounded-2xl bg-card">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Marketplace Overview</h3>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 bg-muted/30 rounded-xl border border-border/50">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Selling Price</p>
                <p className="text-lg font-black text-foreground mt-0.5">
                  {currentPriceGhs > 0 ? `GH₵ ${currentPriceGhs.toFixed(2)}` : "Not set"}
                </p>
              </div>

              <div className="p-3 bg-muted/30 rounded-xl border border-border/50">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Stock Level</p>
                <p className={`text-lg font-black mt-0.5 ${currentStock > 0 ? "text-success" : "text-destructive"}`}>
                  {currentStock} units
                </p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs pt-2 border-t border-border/60">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Category</span>
                <span className="font-semibold text-foreground truncate max-w-[170px]">
                  {categoryName || "Uncategorized"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created Date</span>
                <span className="font-medium text-foreground">
                  {product.created_at ? new Date(product.created_at).toLocaleDateString() : "—"}
                </span>
              </div>
            </div>

            {product.status === "published" && product.handle && (
              <div className="pt-2 border-t border-border/60">
                <a
                  href={`http://127.0.0.1:5175/products/${product.handle}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-bold text-primary hover:bg-primary/5 transition"
                >
                  <ArrowSquareOut className="h-3.5 w-3.5" /> View on Live Store
                </a>
              </div>
            )}
          </Card>
        </div>

        {/* ── Right Column: Form (when editing) or Product Info (when viewing) ── */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          {editing ? (
            /* Edit Mode Form */
            <div className="space-y-6">
              {/* Product Information Card */}
              <Card className="p-6 space-y-5 border border-border/80 shadow-xs rounded-2xl bg-card">
                <h2 className="font-bold text-base text-foreground flex items-center gap-2 border-b border-border/60 pb-3">
                  <Package className="h-5 w-5 text-primary" /> Product Details
                </h2>

                <div className="space-y-2">
                  <Label htmlFor="edit-title" className="text-sm font-semibold">
                    Product Title <span className="text-xs font-normal text-muted-foreground">({form.title.length}/120)</span>
                  </Label>
                  <Input
                    id="edit-title"
                    value={form.title}
                    maxLength={120}
                    placeholder="e.g. Handmade Leather Sandals"
                    onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-desc" className="text-sm font-semibold">
                    Product Description <span className="text-xs font-normal text-muted-foreground">({form.description.length}/2000)</span>
                  </Label>
                  <Textarea
                    id="edit-desc"
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    rows={4}
                    placeholder="Provide materials, size, origin, and care instructions..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-category" className="text-sm font-semibold">
                    Product Category
                  </Label>
                  <Select
                    id="edit-category"
                    value={form.categoryId}
                    onChange={e => setForm(p => ({ ...p, categoryId: e.target.value }))}
                  >
                    <option value="">Select a category</option>
                    {categoriesData?.product_categories?.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </Select>
                </div>
              </Card>

              {/* Pricing & Stock Card (integrated in the form!) */}
              <Card className="p-6 space-y-5 border border-border/80 shadow-xs rounded-2xl bg-card">
                <h2 className="font-bold text-base text-foreground flex items-center gap-2 border-b border-border/60 pb-3">
                  <Tag className="h-5 w-5 text-primary" /> Pricing &amp; Inventory
                </h2>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-price" className="text-sm font-semibold">
                      Selling Price (GH₵)
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground select-none">
                        GH₵
                      </span>
                      <Input
                        id="edit-price"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="pl-13 h-10 font-bold"
                        value={form.priceGhs}
                        onChange={e => setForm(p => ({ ...p, priceGhs: e.target.value }))}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground font-medium">Standard marketplace selling price</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="edit-stock" className="text-sm font-semibold">
                      Available Stock (Units)
                    </Label>
                    <Input
                      id="edit-stock"
                      type="number"
                      step="1"
                      min="0"
                      placeholder="0"
                      className="h-10 font-bold"
                      value={form.stockQty}
                      onChange={e => setForm(p => ({ ...p, stockQty: e.target.value }))}
                    />
                    <p className="text-[11px] text-muted-foreground font-medium">Quantity available for immediate dispatch</p>
                  </div>
                </div>
              </Card>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <Button onClick={handleSave} isLoading={update.isPending} size="lg" className="gap-2 font-bold px-6 shadow-sm">
                  <FloppyDisk className="h-4 w-4" weight="bold" /> Save Changes
                </Button>
                <Button onClick={() => setEditing(false)} variant="outline" size="lg">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            /* View Mode */
            <div className="space-y-6">
              {/* Product Overview Card */}
              <Card className="p-6 space-y-5 border border-border/80 shadow-xs rounded-2xl bg-card">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <h2 className="font-bold text-base text-foreground flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" /> Product Information
                  </h2>
                  <Button onClick={startEditing} variant="outline" size="sm" className="gap-1.5 text-xs font-semibold">
                    <PencilSimple className="h-3.5 w-3.5" /> Edit Information
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Title
                    </span>
                    <p className="text-lg font-bold text-foreground">
                      {product.title || "Untitled"}
                    </p>
                  </div>

                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Category
                    </span>
                    <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-lg bg-muted text-foreground border border-border/60">
                      {categoryName || "Uncategorized"}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Description
                    </span>
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                      {product.description || "No description provided."}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Pricing & Stock Card */}
              <Card className="p-6 space-y-5 border border-border/80 shadow-xs rounded-2xl bg-card">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <h2 className="font-bold text-base text-foreground flex items-center gap-2">
                    <Tag className="h-5 w-5 text-primary" /> Pricing &amp; Stock
                  </h2>
                  {!quickOfferOpen && (
                    <Button
                      onClick={() => {
                        setQuickPrice(currentPriceGhs > 0 ? String(currentPriceGhs) : "")
                        setQuickStock(String(currentStock))
                        setQuickOfferOpen(true)
                      }}
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs font-semibold"
                    >
                      <PencilSimple className="h-3.5 w-3.5" /> Quick Adjust
                    </Button>
                  )}
                </div>

                {!quickOfferOpen ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-muted/20 border border-border/60">
                      <p className="text-xs font-semibold text-muted-foreground">Selling Price</p>
                      <p className="text-2xl font-black text-foreground mt-1">
                        {currentPriceGhs > 0 ? `GH₵ ${currentPriceGhs.toFixed(2)}` : "—"}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">Gross listing price</p>
                    </div>

                    <div className="p-4 rounded-xl bg-muted/20 border border-border/60">
                      <p className="text-xs font-semibold text-muted-foreground">Inventory Status</p>
                      <p className={`text-2xl font-black mt-1 ${currentStock > 0 ? "text-success" : "text-destructive"}`}>
                        {currentStock} units
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {currentStock > 0 ? "In stock & ready to dispatch" : "Marked as out of stock"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-muted/20 border border-border/80 rounded-xl space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="quick-price" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Price (GHS)
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                            GH₵
                          </span>
                          <Input
                            id="quick-price"
                            type="number"
                            step="0.01"
                            min="0"
                            className="pl-13 h-10 font-bold"
                            value={quickPrice}
                            onChange={e => setQuickPrice(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="quick-stock" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Stock Units
                        </Label>
                        <Input
                          id="quick-stock"
                          type="number"
                          step="1"
                          min="0"
                          className="h-10 font-bold"
                          value={quickStock}
                          onChange={e => setQuickStock(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button
                        onClick={() => { void handleSaveQuickOffers() }}
                        isLoading={savingQuickOffers}
                        size="sm"
                        className="gap-1.5 font-bold"
                      >
                        <FloppyDisk className="h-3.5 w-3.5" /> Save Price &amp; Stock
                      </Button>
                      <Button onClick={() => setQuickOfferOpen(false)} variant="outline" size="sm">
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  )
}
