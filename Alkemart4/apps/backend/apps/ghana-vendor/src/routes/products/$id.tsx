import { createFileRoute, useNavigate, Link } from "@tanstack/react-router"
import { useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useProduct, useUpdateProduct, useDeleteProduct, useCategories, useProposeProduct, useUploadImage, useUpdateVariant, useAddOptionValue, useSetOptionValueImage } from "../../lib/hooks"
import { type ProductStatus, type ProductCombo, products as productsApi } from "../../lib/api"
import { ATTRIBUTE_SUGGESTIONS, MAX_ATTRIBUTES, parseProductAttributes } from "@alkemart/shared/product-attributes"
import { toast } from "sonner"
import { Card, Button, Input, Label, Textarea, Skeleton, Badge, Tabs, TabsList, TabsTrigger, TabsContent, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui"
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
  Plus,
} from "@phosphor-icons/react"
import { PageShell } from "../../components/page-shell"
function storefrontBase(): string {
  const raw = (import.meta.env.VITE_ALKEMART_STOREFRONT_URL as string | undefined)?.trim()
  return (raw ? raw : "http://127.0.0.1:5175").replace(/\/$/, "")
}

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
  attributes: { label: string; value: string }[]
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
  // Matrix products manage price/stock per combination (the product-level
  // PATCH 400s for those fields) — the Combinations section owns them.
  const hasOptions = (product?.productOptions?.length ?? 0) > 0
  const combos: ProductCombo[] = product?.combos ?? []
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
    attributes: [],
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
      attributes: product.attributes?.length
        ? product.attributes.map((a) => ({ label: a.label, value: a.value }))
        : [{ label: "", value: "" }],
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
    const parsedAttrs = parseProductAttributes(form.attributes)
    if (!parsedAttrs.ok) {
      toast.error(parsedAttrs.error)
      return
    }

    const patch: {
      title: string
      description?: string
      categories?: { id: string }[]
      thumbnail?: string
      pricePesewas?: string
      onHand?: number
      attributes: { label: string; value: string }[]
    } = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      categories: form.categoryId ? [{ id: form.categoryId }] : [],
      attributes: parsedAttrs.attributes,
      ...(imageUrl ? { thumbnail: imageUrl } : {}),
    }

    const priceRaw = form.priceGhs.trim()
    const stockRaw = form.stockQty.trim()
    if (hasOptions && (priceRaw !== "" || stockRaw !== "")) {
      toast.info("Price & stock live on each combination — saved content only; adjust combos below.")
    }
    if (!hasOptions && priceRaw !== "") {
      const price = parseFloat(priceRaw)
      if (isNaN(price) || price < 0) {
        toast.error("Price must be a valid number.")
        return
      }
      patch.pricePesewas = String(Math.round(price * 100))
    }

    if (!hasOptions && stockRaw !== "") {
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
    if (hasOptions) {
      toast.info("Price & stock live on each combination — adjust them below.")
      return
    }
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
            <Skeleton className="lg:col-span-4 h-80 rounded-lg" />
            <Skeleton className="lg:col-span-8 h-96 rounded-lg" />
          </div>
        </div>
      </PageShell>
    )
  }

  if (isError || !product) {
    return (
      <PageShell>
        <Card className="p-12 text-center max-w-lg mx-auto shadow-xs rounded-lg">
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
      {/* Header: back, identity + live summary, primary actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: "/products" })}
            className="h-8 px-2.5 rounded-lg border-border/80 text-xs font-semibold gap-1.5 hover:bg-muted shrink-0"
            aria-label="Back to products"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
          {displayImage ? (
            <img src={displayImage} alt="" className="h-11 w-11 rounded-lg object-cover border border-border/60 shrink-0" />
          ) : null}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-black text-foreground truncate">{product.title || "Untitled Product"}</h1>
              {statusBadge(product.status || "draft")}
            </div>
            <p className="text-xs text-muted-foreground font-medium mt-0.5 truncate">
              {hasOptions
                ? `${combos.length} combination${combos.length === 1 ? "" : "s"}`
                : currentPriceGhs > 0
                  ? `GH₵ ${currentPriceGhs.toFixed(2)} · ${currentStock} in stock`
                  : `${currentStock} in stock`}
              {categoryName ? ` · ${categoryName}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!editing ? (
            <>
              <Button onClick={startEditing} variant="default" size="sm" className="gap-1.5 font-bold shadow-xs">
                <PencilSimple className="h-4 w-4" /> Edit
              </Button>
              {(product.status === "draft" || product.status === "rejected") && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 font-semibold"
                  onClick={handleReSubmit}
                  isLoading={propose.isPending}
                >
                  <PaperPlaneTilt className="h-4 w-4" />
                  {product.status === "draft" ? "Submit" : "Re-submit"}
                </Button>
              )}
              {product.status !== "published" && !confirmDelete ? (
                <Button
                  onClick={() => setConfirmDelete(true)}
                  variant="outline"
                  size="sm"
                  aria-label="Delete product"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <Trash className="h-4 w-4" />
                </Button>
              ) : product.status !== "published" ? (
                <div className="flex gap-1.5 items-center bg-destructive/10 border border-destructive/30 p-1 rounded-lg">
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
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Editing</span>
          )}
        </div>
      </div>

      {/* Moderation alerts */}
      {rejectionReason && (
        <div className="p-4 bg-destructive/10 border-2 border-destructive/30 rounded-lg">
          <div className="flex items-start gap-3">
            <WarningCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-sm text-destructive">Needs attention</h3>
              <p className="text-sm text-destructive/90 mt-0.5">{rejectionReason}</p>
              {openAppeal ? (
                <p className="text-xs font-bold text-primary mt-2 flex items-center gap-1.5">
                  <Clock className="h-4 w-4" /> Appeal in review.
                </p>
              ) : closedAppeal ? (
                <p className="text-xs text-muted-foreground mt-2">
                  Appeal decision: <strong>{closedAppeal.decision}</strong>
                  {closedAppeal.response ? ` — “${closedAppeal.response}”` : ""}
                </p>
              ) : appealOpen ? (
                <div className="mt-3 space-y-2 max-w-lg">
                  <Textarea
                    placeholder="Why should ops take another look?"
                    value={appealMessage}
                    onChange={e => setAppealMessage(e.target.value)}
                    rows={3}
                    className="text-xs"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => { void handleAppeal() }}>Send appeal</Button>
                    <Button size="sm" variant="outline" onClick={() => { setAppealOpen(false); setAppealMessage("") }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="outline" className="mt-3 text-xs" onClick={() => setAppealOpen(true)}>
                  Appeal
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {changesRequestedReason && !rejectionReason && (
        <div className="p-4 bg-warning/10 border border-warning/30 rounded-lg">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-warning-fg shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-sm text-warning-fg">Changes requested</h3>
              <p className="text-sm text-warning-fg/90 mt-0.5">{changesRequestedReason}</p>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto rounded-lg [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsTrigger value="overview" className="gap-1.5 rounded-lg">
            <Package className="h-4 w-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="media" className="gap-1.5 rounded-lg">
            <UploadSimple className="h-4 w-4" /> Photo
          </TabsTrigger>
          <TabsTrigger value="pricing" className="gap-1.5 rounded-lg">
            <CurrencyCircleDollar className="h-4 w-4" /> Price &amp; stock
          </TabsTrigger>
          {!editing && hasOptions ? (
            <TabsTrigger value="variants" className="gap-1.5 rounded-lg">
              <Tag className="h-4 w-4" /> Combinations
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="overview">
          {editing ? (
            <Card className="p-6 space-y-5 border border-border/80 shadow-xs rounded-lg bg-card">
              <div className="space-y-2">
                <Label htmlFor="edit-title" className="text-sm font-semibold">
                  Title <span className="text-xs font-normal text-muted-foreground">({form.title.length}/120)</span>
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
                  Description <span className="text-xs font-normal text-muted-foreground">({form.description.length}/2000)</span>
                </Label>
                <Textarea
                  id="edit-desc"
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  rows={4}
                  placeholder="Materials, size, origin, care…"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-category" className="text-sm font-semibold">
                  Category
                </Label>
                <Select
                  value={form.categoryId}
                  onValueChange={v => setForm(p => ({ ...p, categoryId: v }))}
                >
                  <SelectTrigger id="edit-category">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoriesData?.product_categories?.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm font-semibold">Product stats</Label>
                  <span className="text-xs text-muted-foreground">Facts buyers scan — volume, pack, origin. Not variants.</span>
                </div>
                <div className="flex flex-col gap-2">
                  {form.attributes.map((row, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        list="attr-suggestions"
                        aria-label={`Attribute ${index + 1} label`}
                        placeholder="Label"
                        value={row.label}
                        maxLength={40}
                        onChange={(e) => setForm((p) => ({
                          ...p,
                          attributes: p.attributes.map((a, i) => i === index ? { ...a, label: e.target.value } : a),
                        }))}
                      />
                      <Input
                        aria-label={`Attribute ${index + 1} value`}
                        placeholder="Value"
                        value={row.value}
                        maxLength={120}
                        onChange={(e) => setForm((p) => ({
                          ...p,
                          attributes: p.attributes.map((a, i) => i === index ? { ...a, value: e.target.value } : a),
                        }))}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        aria-label={`Remove attribute ${index + 1}`}
                        onClick={() => setForm((p) => ({ ...p, attributes: p.attributes.filter((_, i) => i !== index) }))}
                      >
                        <Trash className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  ))}
                </div>
                <datalist id="attr-suggestions">
                  {(ATTRIBUTE_SUGGESTIONS["food-groceries"] ?? []).map((label) => (
                    <option key={label} value={label} />
                  ))}
                </datalist>
                {form.attributes.length < MAX_ATTRIBUTES ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setForm((p) => ({ ...p, attributes: [...p.attributes, { label: "", value: "" }] }))}
                  >
                    <Plus className="mr-1.5 h-4 w-4" aria-hidden />
                    Add fact
                  </Button>
                ) : null}
              </div>
            </Card>
          ) : (
            <Card className="p-6 space-y-4 border border-border/80 shadow-xs rounded-lg bg-card">
              <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {product.description || "No description yet — add one so shoppers know what they're buying."}
              </p>
              {(product.attributes ?? []).length ? (
                <p className="text-sm text-muted-foreground">
                  {(product.attributes ?? []).map((a, i) => (
                    <span key={a.label}>
                      {i > 0 ? " · " : null}
                      <span className="font-semibold text-foreground">{a.label}:</span> {a.value}
                    </span>
                  ))}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">No product stats yet — add volume, pack size, origin so buyers can confirm they have the right item.</p>
              )}
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-border/60">
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">Category</dt>
                  <dd className="inline-block text-xs font-semibold px-2.5 py-1 rounded-lg bg-muted text-foreground border border-border/60">
                    {categoryName || "Uncategorized"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">Reference</dt>
                  <dd className="text-xs font-mono font-semibold text-foreground">
                    {product.handle || product.id.slice(0, 12)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">Created</dt>
                  <dd className="text-xs font-medium text-foreground">
                    {product.created_at ? new Date(product.created_at).toLocaleDateString() : "—"}
                  </dd>
                </div>
              </dl>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="media">
          <Card className="overflow-hidden border border-border/80 shadow-xs rounded-lg bg-card">
            <div className="aspect-video bg-muted/40 relative overflow-hidden flex items-center justify-center">
              {displayImage ? (
                <img
                  src={displayImage}
                  alt={product.title || "Product"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40">
                  <Package className="h-16 w-16 stroke-[1.5]" />
                  <span className="text-xs font-semibold mt-2">No photo yet</span>
                </div>
              )}
              <div className="absolute top-3 right-3">
                {statusBadge(product.status || "draft")}
              </div>
            </div>
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
                    {form.imageUrl ? "Replace photo" : "Upload photo"}
                  </Button>
                  {form.imageUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setForm(p => ({ ...p, imageUrl: "" }))}
                      className="text-xs text-destructive hover:bg-destructive/10 px-2"
                      aria-label="Remove photo"
                    >
                      <Trash className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                {!showUrlInput ? (
                  <button
                    type="button"
                    onClick={() => setShowUrlInput(true)}
                    className="text-xs font-semibold text-primary hover:underline block text-center w-full"
                  >
                    Or paste an image URL
                  </button>
                ) : (
                  <Input
                    id="edit-image-url"
                    type="url"
                    placeholder="https://example.com/image.webp"
                    value={form.imageUrl}
                    onChange={e => setForm(p => ({ ...p, imageUrl: e.target.value }))}
                    className="text-xs h-8"
                  />
                )}
              </div>
            )}
            {product.status === "published" && product.handle && (
              <div className="p-3.5 bg-muted/15 border-t border-border/60">
                <a
                  href={`${storefrontBase()}/products/${product.handle}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-border/70 bg-background text-xs font-bold text-foreground hover:text-primary hover:border-primary/50 shadow-2xs transition"
                >
                  <ArrowSquareOut className="h-3.5 w-3.5 text-primary" /> View on live store
                </a>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="pricing">
          {editing && !hasOptions ? (
            <Card className="p-6 space-y-5 border border-border/80 shadow-xs rounded-lg bg-card">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-price" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Price (GH₵)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground select-none">
                      GH₵
                    </span>
                    <Input
                      id="edit-price"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="pl-14 h-11 text-base font-bold bg-background rounded-lg"
                      value={form.priceGhs}
                      onChange={e => setForm(p => ({ ...p, priceGhs: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-stock" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Stock (units)
                  </Label>
                  <Input
                    id="edit-stock"
                    type="number"
                    step="1"
                    min="0"
                    placeholder="0"
                    className="h-11 text-base font-bold bg-background rounded-lg"
                    value={form.stockQty}
                    onChange={e => setForm(p => ({ ...p, stockQty: e.target.value }))}
                  />
                </div>
              </div>
              {(() => {
                const p = parseFloat(form.priceGhs) || 0
                const s = parseInt(form.stockQty, 10) || 0
                if (p > 0 && s > 0) {
                  return (
                    <p className="flex items-center justify-between p-3.5 rounded-lg bg-muted border border-primary/25 text-xs font-semibold">
                      Stock value
                      <span className="font-black text-sm tabular-nums">
                        GH₵ {(p * s).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </p>
                  )
                }
                return null
              })()}
            </Card>
          ) : editing ? (
            <Card className="p-6 border border-border/80 shadow-xs rounded-lg bg-card">
              <p className="text-sm text-muted-foreground">
                Price &amp; stock live on each combination — finish content edits here, then adjust them under <strong>Combinations</strong>.
              </p>
            </Card>
          ) : !quickOfferOpen ? (
            <Card className="p-6 space-y-4 border border-border/80 shadow-xs rounded-lg bg-card">
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-3">
                  <p className="text-3xl font-black text-foreground tabular-nums tracking-tight">
                    {hasOptions ? `${combos.length} combos` : currentPriceGhs > 0 ? `GH₵ ${currentPriceGhs.toFixed(2)}` : "—"}
                  </p>
                  {!hasOptions ? (
                    <Badge tone={currentStock > 0 ? "success" : "danger"} emphasis="soft" size="sm">
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {currentStock > 0 ? `${currentStock.toLocaleString()} in stock` : "Out of stock"}
                    </Badge>
                  ) : null}
                </div>
                {!hasOptions ? (
                  <Button
                    onClick={() => {
                      setQuickPrice(currentPriceGhs > 0 ? String(currentPriceGhs) : "")
                      setQuickStock(String(currentStock))
                      setQuickOfferOpen(true)
                    }}
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs font-bold rounded-lg"
                  >
                    <PencilSimple className="h-3.5 w-3.5 text-primary" /> Adjust
                  </Button>
                ) : null}
              </div>
              {!hasOptions && currentPriceGhs > 0 && currentStock > 0 ? (
                <p className="text-xs font-medium text-muted-foreground border-t border-border/60 pt-3">
                  Stock value{" "}
                  <span className="font-bold text-foreground tabular-nums">
                    GH₵ {(currentPriceGhs * currentStock).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </p>
              ) : null}
            </Card>
          ) : (
            <Card className="p-6 space-y-4 border border-border/80 shadow-xs rounded-lg bg-card">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="quick-price" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Price (GH₵)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                      GH₵
                    </span>
                    <Input
                      id="quick-price"
                      type="number"
                      step="0.01"
                      min="0"
                      className="pl-14 h-11 text-base font-bold bg-background rounded-lg"
                      value={quickPrice}
                      onChange={e => setQuickPrice(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="quick-stock" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Stock (units)
                  </Label>
                  <Input
                    id="quick-stock"
                    type="number"
                    step="1"
                    min="0"
                    className="h-11 text-base font-bold bg-background rounded-lg"
                    value={quickStock}
                    onChange={e => setQuickStock(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => { void handleSaveQuickOffers() }}
                  isLoading={savingQuickOffers}
                  size="sm"
                  className="gap-1.5 font-bold rounded-lg"
                >
                  <FloppyDisk className="h-3.5 w-3.5" /> Save
                </Button>
                <Button onClick={() => setQuickOfferOpen(false)} variant="outline" size="sm" className="rounded-lg">
                  Cancel
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>

        {!editing && hasOptions ? (
          <TabsContent value="variants">
            <VariantsSection productId={id} />
          </TabsContent>
        ) : null}
      </Tabs>

      {editing ? (
        <div className="sticky bottom-0 z-20 -mx-4 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex items-center justify-end gap-2">
            <Button onClick={() => setEditing(false)} variant="outline" size="sm" className="rounded-lg">
              Cancel
            </Button>
            <Button onClick={handleSave} isLoading={update.isPending} size="sm" className="gap-1.5 font-bold shadow-xs rounded-lg">
              <FloppyDisk className="h-4 w-4" /> Save changes
            </Button>
          </div>
        </div>
      ) : null}
    </PageShell>
  )
}

function comboDisplayName(combo: ProductCombo): string {
  const parts = Object.entries(combo.options ?? {})
  if (combo.title && combo.title !== "Default") return combo.title
  return parts.length > 0 ? parts.map(([, v]) => v).join(" / ") : (combo.title || "Standard")
}

function VariantsSection({ productId }: { productId: string }) {
  const qc = useQueryClient()
  const { data } = useProduct(productId)
  const product = data?.product
  const updateVariant = useUpdateVariant()
  const addOption = useAddOptionValue()

  const combos: ProductCombo[] = product?.combos ?? []
  const options = product?.productOptions ?? []
  type ComboEdit = {
    price: string
    stock: string
    condition: string
    compareAt: string
    compareAtSource: string
    deliveryPromise: string
    warrantyRef: string
    returnsRef: string
    fulfillmentOrigin: string
  }
  const [edits, setEdits] = useState<Record<string, ComboEdit>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [newValue, setNewValue] = useState("")
  const [newOption, setNewOption] = useState("")
  const [existingValue, setExistingValue] = useState("")
  const [addingOption, setAddingOption] = useState(false)

  const editOf = (combo: ProductCombo): ComboEdit =>
    edits[combo.variantId] ?? {
      price: combo.priceGhs > 0 ? String(combo.priceGhs) : "",
      stock: String(combo.onHand),
      condition: combo.condition ?? "unspecified",
      compareAt: combo.compareAtGhs != null && combo.compareAtGhs > 0 ? String(combo.compareAtGhs) : "",
      compareAtSource: combo.compareAtSource ?? "",
      deliveryPromise: combo.deliveryPromise ?? "",
      warrantyRef: combo.warrantyRef ?? "",
      returnsRef: combo.returnsRef ?? "",
      fulfillmentOrigin: combo.fulfillmentOrigin ?? "",
    }
  const setEdit = (variantId: string, patch: Partial<ComboEdit>) => {
    const current = combos.find((c) => c.variantId === variantId)
    if (!current) return
    setEdits((p) => ({ ...p, [variantId]: { ...editOf(current), ...patch } }))
  }
  const isDirty = (combo: ProductCombo) => {
    const e = edits[combo.variantId]
    if (!e) return false
    const fresh: ComboEdit = {
      price: combo.priceGhs > 0 ? String(combo.priceGhs) : "",
      stock: String(combo.onHand),
      condition: combo.condition ?? "unspecified",
      compareAt: combo.compareAtGhs != null && combo.compareAtGhs > 0 ? String(combo.compareAtGhs) : "",
      compareAtSource: combo.compareAtSource ?? "",
      deliveryPromise: combo.deliveryPromise ?? "",
      warrantyRef: combo.warrantyRef ?? "",
      returnsRef: combo.returnsRef ?? "",
      fulfillmentOrigin: combo.fulfillmentOrigin ?? "",
    }
    return (Object.keys(fresh) as (keyof ComboEdit)[]).some((k) => e[k] !== fresh[k])
  }

  const handleSaveCombo = async (combo: ProductCombo) => {
    const e = editOf(combo)
    const patch: {
      pricePesewas?: string
      onHand?: number
      condition?: string | null
      compareAtPesewas?: string | null
      compareAtProvenance?: string | null
      fulfillmentOrigin?: string | null
      warrantyRef?: string | null
      returnsRef?: string | null
      deliveryPromise?: string | null
    } = {}
    if (e.price.trim() !== "") {
      const price = parseFloat(e.price)
      if (isNaN(price) || price < 0) {
        toast.error("Enter a valid price.")
        return
      }
      patch.pricePesewas = String(Math.round(price * 100))
    }
    if (e.stock.trim() !== "") {
      const qty = Number(e.stock)
      if (!Number.isInteger(qty) || qty < 0) {
        toast.error("Stock must be a whole number of 0 or more.")
        return
      }
      patch.onHand = qty
    }
    // Offer terms (Phase 3A): a was-price without a source is rejected —
    // the discount must reference something real.
    const text = (v: string) => (v.trim() ? v.trim() : null)
    patch.condition = e.condition === "unspecified" ? null : e.condition
    if (e.compareAt.trim() !== "") {
      const was = parseFloat(e.compareAt)
      if (isNaN(was) || was <= 0) {
        toast.error("Enter a valid was-price.")
        return
      }
      if (!text(e.compareAtSource)) {
        toast.error("A was-price needs a source (e.g. supplier list price).")
        return
      }
      patch.compareAtPesewas = String(Math.round(was * 100))
      patch.compareAtProvenance = text(e.compareAtSource)
    } else {
      patch.compareAtPesewas = null
      patch.compareAtProvenance = null
    }
    patch.deliveryPromise = text(e.deliveryPromise)
    patch.warrantyRef = text(e.warrantyRef)
    patch.returnsRef = text(e.returnsRef)
    patch.fulfillmentOrigin = text(e.fulfillmentOrigin)
    setSavingId(combo.variantId)
    try {
      await updateVariant.mutateAsync({ productId, variantId: combo.variantId, patch })
      toast.success(comboDisplayName(combo) + " updated - stays live, no re-review.")
      setEdits((p) => {
        const next = { ...p }
        delete next[combo.variantId]
        return next
      })
      qc.invalidateQueries({ queryKey: ["vendor", "products", productId] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update combination.")
    } finally {
      setSavingId(null)
    }
  }

  const handleToggleActive = async (combo: ProductCombo) => {
    setSavingId(combo.variantId)
    try {
      await updateVariant.mutateAsync({
        productId,
        variantId: combo.variantId,
        patch: { active: !combo.active },
      })
      toast.success(combo.active ? comboDisplayName(combo) + " archived." : comboDisplayName(combo) + " back live.")
      qc.invalidateQueries({ queryKey: ["vendor", "products", productId] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update combination.")
    } finally {
      setSavingId(null)
    }
  }

  const handleAddValue = async () => {
    if (!newValue.trim()) {
      toast.error("Enter a value first (e.g. XL).")
      return
    }
    try {
      if (addingOption) {
        if (!newOption.trim()) {
          toast.error("Name the new option type (e.g. Colour).")
          return
        }
        if (!existingValue.trim()) {
          toast.error("Label what your current listing is (e.g. Red).")
          return
        }
        await addOption.mutateAsync({
          productId,
          input: { optionName: newOption.trim(), value: newValue.trim(), existingValue: existingValue.trim() },
        })
      } else {
        const target = options.length === 1 ? options[0] : undefined
        if (!target) {
          toast.error("Pick which option this value belongs to.")
          return
        }
        await addOption.mutateAsync({ productId, input: { optionId: target.id, value: newValue.trim() } })
      }
      toast.success("Combination added - new stock starts at 0, review may re-open.")
      setNewValue("")
      setNewOption("")
      setExistingValue("")
      setAddingOption(false)
      qc.invalidateQueries({ queryKey: ["vendor", "products", productId] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add combination.")
    }
  }

  return (
    <Card className="p-6 space-y-5 border border-border/80 shadow-xs rounded-lg bg-card">
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div>
          <h2 className="font-bold text-base text-foreground flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" /> Combinations
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground tabular-nums">
              {combos.length}
            </span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {options.length === 0
              ? "Single listing. Add an option type to sell variations."
              : "Price, stock & offer terms per combination - edits stay live, no re-review."}
          </p>
        </div>
      </div>

      {combos.length > 0 && (
        <ul className="space-y-2">
          {combos.map((combo) => {
            const e = editOf(combo)
            const dirty = isDirty(combo)
            return (
              <li
                key={combo.variantId}
                className={"rounded-lg border p-4 space-y-3 " + (combo.active ? "border-border/60 bg-muted/20" : "border-dashed border-border bg-muted/10 opacity-80")}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm">{comboDisplayName(combo)}</span>
                  {combo.sku && (
                    <span className="text-xs font-mono text-muted-foreground">{combo.sku}</span>
                  )}
                  {combo.condition && combo.condition !== "unspecified" ? (
                    <Badge tone="neutral" emphasis="soft" size="sm">
                      {combo.condition === "locally_used" ? "Locally used" : combo.condition === "new" ? "New" : "Refurbished"}
                    </Badge>
                  ) : null}
                  {combo.compareAtGhs != null && combo.compareAtGhs > 0 ? (
                    <Badge tone="neutral" emphasis="soft" size="sm" className="tabular-nums">
                      Was GH₵{combo.compareAtGhs.toFixed(2)}
                    </Badge>
                  ) : null}
                  <Badge
                    tone={combo.active ? "success" : "neutral"}
                    emphasis="soft"
                    size="sm"
                    className="ml-auto"
                  >
                    {combo.active ? (combo.onHand > 0 ? "Live" : "Live - Unstocked") : "Archived"}
                  </Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor={"combo-price-" + combo.variantId} className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Price (GHS)
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                        GHc
                      </span>
                      <Input
                        id={"combo-price-" + combo.variantId}
                        type="number"
                        step="0.01"
                        min="0"
                        className="pl-11 h-10 text-sm font-bold bg-background rounded-lg"
                        value={e.price}
                        onChange={(ev) => setEdit(combo.variantId, { price: ev.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={"combo-stock-" + combo.variantId} className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Stock
                    </Label>
                    <Input
                      id={"combo-stock-" + combo.variantId}
                      type="number"
                      step="1"
                      min="0"
                      className="h-10 text-sm font-bold bg-background rounded-lg tabular-nums"
                      value={e.stock}
                      onChange={(ev) => setEdit(combo.variantId, { stock: ev.target.value })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={!dirty || savingId === combo.variantId}
                      isLoading={savingId === combo.variantId}
                      onClick={() => { void handleSaveCombo(combo) }}
                      className="rounded-lg font-bold"
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={savingId === combo.variantId}
                      onClick={() => { void handleToggleActive(combo) }}
                      className="rounded-lg"
                    >
                      {combo.active ? "Archive" : "Restore"}
                    </Button>
                  </div>
                </div>
                <details className="rounded-lg border border-border/60 bg-background/60 px-3 py-2">
                  <summary className="cursor-pointer text-xs font-bold text-muted-foreground hover:text-foreground">
                    Offer terms — condition, was-price, delivery & policy refs
                  </summary>
                  <div className="grid gap-3 pt-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor={"combo-condition-" + combo.variantId} className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Condition
                      </Label>
                      <Select
                        value={e.condition}
                        onValueChange={(v) => setEdit(combo.variantId, { condition: v })}
                      >
                        <SelectTrigger id={"combo-condition-" + combo.variantId} className="h-10 bg-background rounded-lg text-sm">
                          <SelectValue placeholder="Unspecified" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unspecified">Unspecified</SelectItem>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="locally_used">Locally used</SelectItem>
                          <SelectItem value="refurbished">Refurbished</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={"combo-delivery-" + combo.variantId} className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Delivery promise
                      </Label>
                      <Input
                        id={"combo-delivery-" + combo.variantId}
                        maxLength={200}
                        placeholder="e.g. 2–3 days in Accra"
                        className="h-10 text-sm bg-background rounded-lg"
                        value={e.deliveryPromise}
                        onChange={(ev) => setEdit(combo.variantId, { deliveryPromise: ev.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={"combo-was-" + combo.variantId} className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Was-price (GHS)
                      </Label>
                      <Input
                        id={"combo-was-" + combo.variantId}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Optional"
                        className="h-10 text-sm bg-background rounded-lg tabular-nums"
                        value={e.compareAt}
                        onChange={(ev) => setEdit(combo.variantId, { compareAt: ev.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={"combo-source-" + combo.variantId} className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Was-price source
                      </Label>
                      <Input
                        id={"combo-source-" + combo.variantId}
                        maxLength={500}
                        placeholder="Required when was-price is set"
                        className="h-10 text-sm bg-background rounded-lg"
                        value={e.compareAtSource}
                        onChange={(ev) => setEdit(combo.variantId, { compareAtSource: ev.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={"combo-warranty-" + combo.variantId} className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Warranty ref
                      </Label>
                      <Input
                        id={"combo-warranty-" + combo.variantId}
                        maxLength={500}
                        placeholder="e.g. 6-month shop warranty"
                        className="h-10 text-sm bg-background rounded-lg"
                        value={e.warrantyRef}
                        onChange={(ev) => setEdit(combo.variantId, { warrantyRef: ev.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={"combo-returns-" + combo.variantId} className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Returns ref
                      </Label>
                      <Input
                        id={"combo-returns-" + combo.variantId}
                        maxLength={500}
                        placeholder="e.g. 7-day returns"
                        className="h-10 text-sm bg-background rounded-lg"
                        value={e.returnsRef}
                        onChange={(ev) => setEdit(combo.variantId, { returnsRef: ev.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor={"combo-origin-" + combo.variantId} className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Fulfillment origin
                      </Label>
                      <Input
                        id={"combo-origin-" + combo.variantId}
                        maxLength={200}
                        placeholder="e.g. Accra warehouse"
                        className="h-10 text-sm bg-background rounded-lg"
                        value={e.fulfillmentOrigin}
                        onChange={(ev) => setEdit(combo.variantId, { fulfillmentOrigin: ev.target.value })}
                      />
                    </div>
                  </div>
                  <p className="pt-2 text-xs leading-relaxed text-muted-foreground">
                    Was-prices show to buyers only with a source. Empty fields stay empty — never invent a warranty buyers can't claim.
                  </p>
                </details>
              </li>
            )
          })}
        </ul>
      )}

      <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
        <h3 className="font-bold text-sm">Add a combination</h3>
        {options.length > 0 && !addingOption ? (
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={newValue}
              maxLength={41}
              placeholder={"New value (e.g. XL)"}
              onChange={(e) => setNewValue(e.target.value)}
              className="h-10 bg-background rounded-lg"
              aria-label="New option value"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { void handleAddValue() }} isLoading={addOption.isPending} className="rounded-lg font-bold whitespace-nowrap">
                Add value
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAddingOption(true)} className="rounded-lg whitespace-nowrap">
                + Option type
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              value={newOption}
              maxLength={41}
              placeholder="Option name (e.g. Colour)"
              onChange={(e) => setNewOption(e.target.value)}
              className="h-10 bg-background rounded-lg"
              aria-label="New option name"
            />
            <Input
              value={newValue}
              maxLength={41}
              placeholder="New value (e.g. Navy)"
              onChange={(e) => setNewValue(e.target.value)}
              className="h-10 bg-background rounded-lg"
              aria-label="New option value"
            />
            <Input
              value={existingValue}
              maxLength={41}
              placeholder="Current listing is... (e.g. Red)"
              onChange={(e) => setExistingValue(e.target.value)}
              className="h-10 bg-background rounded-lg sm:col-span-2"
              aria-label="Current listing value"
            />
            <div className="flex gap-2 sm:col-span-2">
              <Button size="sm" onClick={() => { void handleAddValue() }} isLoading={addOption.isPending} className="rounded-lg font-bold">
                Add option type
              </Button>
              {options.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => { setAddingOption(false); setNewOption(""); setExistingValue(""); setNewValue("") }} className="rounded-lg">
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground font-medium">
          New combinations start unstocked (0) so nothing oversells. Structural changes send published listings back for review.
        </p>
      </div>

      {options.length > 0 && (
        <ValuePhotos productId={productId} options={options} />
      )}
    </Card>
  )
}

function ValuePhotos({ productId, options }: {
  productId: string
  options: { id: string; name: string; values: { id: string; value: string; imageUrl: string | null }[] }[]
}) {
  const qc = useQueryClient()
  const upload = useUploadImage()
  const setImage = useSetOptionValueImage()
  const [busyId, setBusyId] = useState<string | null>(null)

  const handleFile = async (valueId: string, file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.")
      return
    }
    setBusyId(valueId)
    try {
      const url = await upload.mutateAsync(file)
      await setImage.mutateAsync({ productId, valueId, imageUrl: url })
      toast.success("Swatch photo saved - listing sent back for review.")
      qc.invalidateQueries({ queryKey: ["vendor", "products", productId] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save photo.")
    } finally {
      setBusyId(null)
    }
  }

  const handleRemove = async (valueId: string) => {
    setBusyId(valueId)
    try {
      await setImage.mutateAsync({ productId, valueId, imageUrl: null })
      toast.success("Swatch photo removed.")
      qc.invalidateQueries({ queryKey: ["vendor", "products", productId] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove photo.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
      <h3 className="font-bold text-sm">Swatch photos (optional)</h3>
      <p className="text-xs text-muted-foreground font-medium">
        One photo per value on visual options (e.g. Colour) - buyers see it as the selector tile and gallery lead.
      </p>
      {options.map((opt) => (
        <div key={opt.id} className="space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{opt.name}</p>
          <ul className="flex flex-wrap gap-2">
            {opt.values.map((v) => (
              <li key={v.id} className="flex items-center gap-2 rounded-lg border border-border/60 bg-card px-2 py-1.5">
                {v.imageUrl ? (
                  <img src={v.imageUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
                ) : (
                  <span className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                    {v.value.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span className="text-xs font-bold max-w-24 truncate">{v.value}</span>
                <label className="text-xs font-bold text-primary cursor-pointer hover:underline">
                  {v.imageUrl ? "Replace" : "Add"}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={busyId === v.id}
                    onChange={(e) => { void handleFile(v.id, e.target.files?.[0]); e.target.value = "" }}
                  />
                </label>
                {v.imageUrl && (
                  <button
                    type="button"
                    disabled={busyId === v.id}
                    onClick={() => { void handleRemove(v.id) }}
                    className="text-xs font-bold text-destructive hover:underline disabled:opacity-50"
                    aria-label={'Remove photo for ' + v.value}
                  >
                    {busyId === v.id ? "..." : "Remove"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

