import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useRef, useEffect } from "react"
import { useUploadImage, useQuickSell, useCategories, useReadiness } from "../lib/hooks"
import type { SellerReadiness } from "../lib/api"
import { useQueryClient } from "@tanstack/react-query"
import { Button, Input, Label, Card, Textarea, Select, Skeleton } from "@workspace/ui"
import { UploadCloud, Image as ImageIcon, ArrowRight, CheckCircle2, ChevronLeft, AlertCircle, Clock, ListTree, Plus, Trash2 } from "lucide-react"
import { PageShell } from "../components/page-shell"
import { PageHeader } from "../components/page-header"

export const Route = createFileRoute('/quick-sell')({
  component: QuickSellPage,
})

type Axis = { name: string; values: string }

function parseValues(s: string): string[] {
  return s.split(",").map(v => v.trim()).filter(Boolean)
}

function cartesianProduct(lists: string[][]): string[][] {
  return lists.reduce<string[][]>(
    (acc, list) => (acc.length === 0 ? list.map(v => [v]) : acc.flatMap(a => list.map(v => [...a, v]))),
    [],
  )
}

function QuickSellPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [step, setStep] = useState<1 | 2>(1)
  
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  
  const [title, setTitle] = useState("")
  const [priceGhs, setPriceGhs] = useState("")
  const [description, setDescription] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [hasVariations, setHasVariations] = useState(false)
  const [axes, setAxes] = useState<Axis[]>([{ name: "", values: "" }])
  const [rowData, setRowData] = useState<Record<number, { price: string; quantity: string }>>({})

  const parsedAxes = axes.map(a => ({ name: a.name.trim(), values: parseValues(a.values) })).filter(a => a.name && a.values.length > 0)
  const combos = hasVariations && parsedAxes.length > 0
    ? cartesianProduct(parsedAxes.map(a => a.values))
    : []

  useEffect(() => { setRowData({}) }, [axes])
  
  const upload = useUploadImage()
  const quickSell = useQuickSell()
  const { data: categoriesData } = useCategories()
  const { data: readiness, isLoading: readinessLoading } = useReadiness()
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview) }
  }, [preview])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      if (preview) URL.revokeObjectURL(preview)
      setFile(selected)
      setPreview(URL.createObjectURL(selected))
      setStep(2)
    }
  }

  const [submitError, setSubmitError] = useState<string | null>(null)

  const validate = (): string | null => {
    if (!title || title.trim().length < 3) return "Title must be at least 3 characters."
    if (!priceGhs || Number(priceGhs) < 0.5) return "Price must be at least GH₵0.50."
    if (Number(priceGhs) > 500_000) return "Price must not exceed GH₵500,000."
    if (hasVariations) {
      const incomplete = axes.some(a => a.name.trim() && parseValues(a.values).length < 2)
      if (axes.some(a => !a.name.trim() && a.values.trim())) return "Give every variation type a name (e.g. Size)."
      if (axes.some(a => a.name.trim() && !a.values.trim())) return `Add options for "${axes.find(a => a.name.trim() && !a.values.trim())?.name}" (e.g. Small, Medium, Large).`
      if (incomplete) return "Each variation type needs at least 2 options."
      if (combos.length > 40) return "Too many combinations. Keep it under 40."
      for (const row of Object.values(rowData)) {
        if (row.price && (Number(row.price) < 0.5 || Number(row.price) > 500_000)) return "Variant prices must be between GH₵0.50 and GH₵500,000."
        if (row.quantity && Number(row.quantity) < 1) return "Variant quantities must be at least 1."
      }
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    const validationError = validate()
    if (validationError) {
      setSubmitError(validationError)
      return
    }

    try {
      let imageUrl = undefined
      if (file) {
        imageUrl = await upload.mutateAsync(file)
      }

      const variant_options = hasVariations && parsedAxes.length > 0
        ? parsedAxes.map(a => ({ name: a.name, values: a.values }))
        : undefined

      const variant_entries = combos.map((combo, i) => {
        const options: Record<string, string> = {}
        parsedAxes.forEach((a, j) => { options[a.name] = combo[j] })
        const row = rowData[i]
        return {
          options,
          ...(row?.price && row.price.trim() ? { price_ghs: Number(row.price) } : {}),
          ...(row?.quantity && row.quantity.trim() ? { quantity: Number(row.quantity) } : {}),
        }
      })

      await quickSell.mutateAsync({
        title,
        price_ghs: Number(priceGhs),
        description,
        quantity,
        category_id: categoryId || undefined,
        image_url: imageUrl,
        variant_options,
        ...(variant_entries.length ? { variant_entries } : {}),
      })

      qc.invalidateQueries({ queryKey: ["vendor"] })
      navigate({ to: "/products" })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to list product. Please try again."
      setSubmitError(message)
    }
  }

  const canSell = readiness
    ? readiness.mercur_status === "open" && readiness.setup_complete
    : false
  const blocked = Boolean(readiness && !canSell)
  const validAxes = parsedAxes.length > 0

  return (
    <PageShell className="max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => step === 2 ? setStep(1) : navigate({ to: "/" })}>
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <PageHeader title="Quick Sell" description="List an item in under a minute." />
      </div>

      {readinessLoading ? (
        <Card className="border-2 shadow-lg overflow-hidden">
          <div className="p-8">
            <Skeleton className="h-40 w-full" />
          </div>
        </Card>
      ) : blocked && readiness ? (
        <SetupGate readiness={readiness} />
      ) : (
      <>
      <div className="flex items-center justify-center mb-8">
        <div className="flex items-center gap-2">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${step === 1 ? 'bg-primary text-primary-foreground' : 'bg-primary text-primary-foreground'}`}>1</div>
          <div className={`h-1 w-12 rounded-full transition-colors ${step === 2 ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${step === 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>2</div>
        </div>
      </div>

      <Card className="border-2 shadow-lg overflow-hidden">
        {step === 1 && (
          <div className="p-8 sm:p-12 flex flex-col items-center text-center">
            <div className="h-24 w-24 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-6">
              <ImageIcon className="h-10 w-10" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Snap a Photo</h2>
            <p className="text-muted-foreground font-medium max-w-sm mb-8">
              A clear, well-lit photo makes your item sell faster.
            </p>
            
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            
            <Button 
              size="lg" 
              className="w-full sm:w-auto min-w-[200px] h-14 text-lg gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud className="h-6 w-6" />
              Upload Photo
            </Button>

            <Button 
              variant="ghost" 
              className="mt-4 text-muted-foreground"
              onClick={() => setStep(2)}
            >
              Skip photo for now
            </Button>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="w-full sm:w-1/3">
                <div 
                  className="aspect-square bg-muted rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden relative cursor-pointer group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {preview ? (
                    <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-4">
                      <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <span className="text-xs font-semibold text-muted-foreground">Add Photo</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white font-semibold text-sm">Change</span>
                  </div>
                </div>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
              </div>

              <div className="w-full sm:w-2/3 space-y-5">
                {submitError && (
                  <div className="p-3 bg-destructive/10 text-destructive text-sm font-semibold rounded-lg border border-destructive/20" role="alert">
                    {submitError}
                  </div>
                )}
                {upload.isError && (
                  <div className="p-3 bg-destructive/10 text-destructive text-sm font-semibold rounded-lg border border-destructive/20" role="alert">
                    {upload.error instanceof Error ? upload.error.message : "Failed to upload image."}
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-base">What are you selling?</Label>
                  <Input 
                    id="title" 
                    value={title} 
                    onChange={e => setTitle(e.target.value)} 
                    placeholder="e.g. Fresh Tomatoes, Ankara Fabric..." 
                    autoFocus
                    required 
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="price" className="text-base">Price (GHS)</Label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">₵</span>
                    <Input 
                      id="price" 
                      type="number" 
                      min="0.5"
                      max="500000"
                      step="0.01"
                      className="pl-10 font-bold"
                      value={priceGhs} 
                      onChange={e => setPriceGhs(e.target.value)} 
                      placeholder="0.00" 
                      required 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantity" className="text-base">Quantity</Label>
                  <Input 
                    id="quantity" 
                    type="number" 
                    min="1"
                    step="1"
                    value={quantity} 
                    onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} 
                    placeholder="1" 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category" className="text-base">Category <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                  <Select
                    id="category"
                    value={categoryId}
                    onChange={e => setCategoryId(e.target.value)}
                  >
                    <option value="">Select a category</option>
                    {categoriesData?.product_categories?.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-base">Variations <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setHasVariations(v => !v)}
                    >
                      <ListTree className="h-4 w-4" />
                      {hasVariations ? "Remove variations" : "Add variations"}
                    </Button>
                  </div>
                  {hasVariations && (
                    <div className="space-y-4 rounded-xl border-2 border-border p-4">
                      <p className="text-xs text-muted-foreground font-semibold">
                        e.g. Colour (Red, Blue) or Size (Small, Medium, Large) — each combination gets its own stock and price.
                      </p>

                      {axes.map((axis, i) => (
                        <div key={i} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-bold">Variation {i + 1}</Label>
                            {axes.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive gap-1"
                                onClick={() => setAxes(axes.filter((_, j) => j !== i))}
                              >
                                <Trash2 className="h-4 w-4" /> Remove
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Input
                              value={axis.name}
                              onChange={e => setAxes(axes.map((a, j) => j === i ? { ...a, name: e.target.value } : a))}
                              placeholder="Variation name (e.g. Size)"
                            />
                            <Input
                              value={axis.values}
                              onChange={e => setAxes(axes.map((a, j) => j === i ? { ...a, values: e.target.value } : a))}
                              placeholder="Options, comma-separated (e.g. Small, Medium, Large)"
                            />
                          </div>
                        </div>
                      ))}

                      {axes.length < 3 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => setAxes([...axes, { name: "", values: "" }])}
                        >
                          <Plus className="h-4 w-4" /> Add variation type
                        </Button>
                      )}

                      {validAxes && combos.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-sm font-bold">Stock &amp; price per variation</Label>
                          <div className="rounded-lg border-2 border-border overflow-hidden">
                            <div className="grid grid-cols-[1fr_4.5rem_5.5rem] gap-2 items-center px-3 py-2 bg-muted text-xs font-bold text-muted-foreground uppercase tracking-wide">
                              <span>Variation</span>
                              <span className="text-right">Qty</span>
                              <span className="text-right">Price ₵</span>
                            </div>
                            {combos.map((combo, i) => {
                              const label = parsedAxes.map((a, j) => combo[j]).join(" / ")
                              return (
                                <div key={i} className="grid grid-cols-[1fr_4.5rem_5.5rem] gap-2 items-center px-3 py-2 border-t-2 border-border">
                                  <span className="text-sm font-semibold truncate">{label}</span>
                                  <Input
                                    type="number"
                                    min="1"
                                    step="1"
                                    className="h-9 text-right"
                                    value={rowData[i]?.quantity ?? ""}
                                    placeholder={String(quantity)}
                                    onChange={e => setRowData({ ...rowData, [i]: { ...rowData[i], quantity: e.target.value } })}
                                  />
                                  <Input
                                    type="number"
                                    min="0.5"
                                    max="500000"
                                    step="0.01"
                                    className="h-9 text-right"
                                    value={rowData[i]?.price ?? ""}
                                    placeholder={priceGhs}
                                    onChange={e => setRowData({ ...rowData, [i]: { ...rowData[i], price: e.target.value } })}
                                  />
                                </div>
                              )
                            })}
                          </div>
                          <p className="text-xs text-muted-foreground font-semibold">
                            {combos.length} combination{combos.length === 1 ? "" : "s"} · Blank fields use your base quantity ({quantity}) and price (₵{priceGhs || "0"}).
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="desc" className="text-base">Details <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                  <Textarea 
                    id="desc"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Size, condition, origin..."
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => navigate({ to: "/products" })} disabled={upload.isPending || quickSell.isPending}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                size="lg" 
                className="gap-2 px-8"
                isLoading={upload.isPending || quickSell.isPending}
              >
                <CheckCircle2 className="h-5 w-5" />
                Submit for Review
              </Button>
            </div>
          </form>
        )}
      </Card>
      </>
      )}
    </PageShell>
  )
}

function SetupGate({ readiness }: { readiness: SellerReadiness }) {
  const navigate = useNavigate()

  if (readiness.mercur_status !== "open") {
    const title =
      readiness.mercur_status === "pending_approval"
        ? "Your shop is under review"
        : readiness.mercur_status === "suspended"
          ? "Your shop is paused"
          : "Cannot list products right now"
    return (
      <Card className="border-2 shadow-lg overflow-hidden">
        <div className="p-8 sm:p-12 text-center">
          <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">{title}</h2>
          <p className="text-muted-foreground font-medium max-w-sm mx-auto">
            {readiness.next_action?.label || "Check back soon."}
          </p>
        </div>
      </Card>
    )
  }

  const items = Object.entries(readiness.checklist)
  const targetTab: "profile" | "dispatch" = readiness.checklist.profile ? "dispatch" : "profile"
  const missing = items.filter(([, done]) => !done).length

  return (
    <Card className="border-2 shadow-lg overflow-hidden">
      <div className="p-8 sm:p-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-11 w-11 rounded-full bg-warning/10 text-warning flex items-center justify-center shrink-0">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Finish setting up your shop</h2>
            <p className="text-sm text-muted-foreground font-medium">
              One-time setup so buyers know where to pick up. {missing} step{missing === 1 ? "" : "s"} left.
            </p>
          </div>
        </div>

        <ul className="space-y-2 mb-8">
          {items.map(([key, done]) => (
            <li key={key} className="flex items-center gap-3 p-3 rounded-xl border-2 border-border">
              {done ? (
                <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-warning shrink-0" />
              )}
              <span className="font-semibold text-sm">
                {readiness.checklist_labels?.[key] ?? key}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex justify-end">
          <Button
            size="lg"
            className="gap-2 px-8"
            onClick={() => navigate({ to: "/settings", search: { tab: targetTab } })}
          >
            Complete setup <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </Card>
  )
}