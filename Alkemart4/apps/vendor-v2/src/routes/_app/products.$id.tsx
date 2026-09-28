import { useState } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Alert02Icon, ArrowLeft01Icon, Clock01Icon, Delete02Icon, LinkSquare02Icon, MagicWand01Icon, MinusSignIcon, Add01Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"
import { checkListing } from "@alkemart/domain"
import { Button } from "@workspace/console-ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/console-ui/components/card"
import { Input } from "@workspace/console-ui/components/input"
import { Label } from "@workspace/console-ui/components/label"
import { Skeleton } from "@workspace/console-ui/components/skeleton"
import { Spinner } from "@workspace/console-ui/components/spinner"
import { Switch } from "@workspace/console-ui/components/switch"
import { Textarea } from "@workspace/console-ui/components/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/console-ui/components/alert-dialog"
import { ErrorState } from "@workspace/console-ui/components/console/states"
import { currencySymbol, formatMinor, minorToMajorText, parseMajorToMinor } from "@workspace/console-ui/lib/money"
import { cn } from "@workspace/console-ui/lib/utils"
import { CategoryPicker } from "@/components/products/category-picker"
import { PhotoPicker } from "@/components/products/photo-picker"
import { SpecFields } from "@/components/products/spec-fields"
import { isAnswered, type SpecValues } from "@/lib/product-form"
import { getStorefrontUrl } from "@/lib/env"
import { useSeller } from "@/lib/queries"
import {
  appealProduct,
  deleteProduct,
  formFields,
  getAttributes,
  getProduct,
  sendForReview,
  setAttributes,
  setImages,
  shelfOf,
  suggestAttributes,
  updateProduct,
  updateVariant,
  type Combo,
  type VendorProduct,
} from "@/lib/products"
import { productsKey } from "./products.index"

export const Route = createFileRoute("/_app/products/$id")({ component: ProductPage })

const productKey = (id: string) => ["products", id] as const

function errText(e: unknown) {
  const x = e as { status?: number; message?: string }
  return x.status == null ? "No connection — nothing changed. Try again." : x.message || "Something went wrong."
}

function ProductPage() {
  const { id } = Route.useParams()
  const q = useQuery({ queryKey: productKey(id), queryFn: () => getProduct(id) })
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/products" className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-semibold text-muted-foreground hover:text-foreground">
        <HugeiconsIcon icon={ArrowLeft01Icon} className="size-5" aria-hidden /> Products
      </Link>
      {q.isPending ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : q.isError ? (
        <ErrorState
          title={(q.error as { status?: number }).status === 404 ? "We couldn't find this product" : "This product didn't load"}
          error={(q.error as { status?: number }).status === 404 ? undefined : q.error}
          onRetry={() => void q.refetch()}
          className="rounded-2xl border bg-card"
        />
      ) : (
        <Editor key={q.data.product.id} p={q.data} />
      )}
    </div>
  )
}

function useRefresh(id: string) {
  const qc = useQueryClient()
  return (next?: VendorProduct) => {
    if (next) qc.setQueryData(productKey(id), next)
    void qc.invalidateQueries({ queryKey: productsKey })
  }
}

function Editor({ p }: { p: VendorProduct }) {
  const id = p.product.id
  const refresh = useRefresh(id)
  const shelf = shelfOf(p)
  const seller = useSeller()
  const live = p.product.status === "published"
  const shopUrl = seller.data ? `${getStorefrontUrl()}/product/${id}` : null
  const findings = checkListing({
    title: p.product.title,
    description: p.product.description,
    imageCount: p.images.length || (p.product.imageUrl ? 1 : 0),
    prices: (p.variants.length ? p.variants : [{ offer: p.offer } as Combo]).filter((c) => c.offer.active).map((c) => Number(c.offer.pricePesewas)),
    categoryId: p.product.primaryCategoryId,
  })
  const review = useMutation({
    mutationFn: () => sendForReview(id),
    onSuccess: (next) => {
      refresh(next)
      const d = (next as VendorProduct & { review?: { decision: string } | null }).review?.decision
      toast.success(
        d === "approve" ? "It's live! Buyers can find it now." : d === "request_changes" ? "A few things need fixing — see the list above." : "Sent for a quick check — we'll let you know.",
      )
    },
    onError: (e) => toast.error(errText(e)),
  })

  return (
    <>
      <header className="space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-[1.75rem]">{p.product.title}</h1>
        {live && shopUrl ? (
          <a href={shopUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline">
            <HugeiconsIcon icon={LinkSquare02Icon} className="size-4" aria-hidden /> See it in your shop <span className="sr-only">(opens in a new tab)</span>
          </a>
        ) : null}
      </header>

      {/* Status banner: what it means and the one thing to do next. */}
      {shelf === "needs-changes" ? (
        <NeedsChanges p={p} onResend={() => review.mutate()} resending={review.isPending} />
      ) : p.product.status === "draft" ? (
        <Banner tone="neutral" icon={Clock01Icon} title="Draft — buyers can't see this yet">
          {findings.some((f) => f.severity === "block") ? (
            <span>Fix: {findings.filter((f) => f.severity === "block").map((f) => f.message).join(" ")}</span>
          ) : (
            <Button variant="brand" size="lg" className="mt-2" onClick={() => review.mutate()} disabled={review.isPending}>
              {review.isPending ? <Spinner /> : null} Publish
            </Button>
          )}
        </Banner>
      ) : p.product.status === "proposed" ? (
        <Banner tone="info" icon={Clock01Icon} title="In review">
          We're checking it before it goes live. You can still fix price and stock.
        </Banner>
      ) : shelf === "out-of-stock" ? (
        <Banner tone="warning" icon={Alert02Icon} title="Live, but out of stock">
          Buyers can see it but can't order. Add stock below.
        </Banner>
      ) : (
        <Banner tone="success" icon={CheckmarkCircle02Icon} title="Live — buyers can order this" />
      )}

      <PhotosCard p={p} onSaved={refresh} />
      <DetailsCard p={p} onSaved={refresh} />
      <StockCard p={p} onSaved={refresh} />
      <SpecsCard p={p} />
      <DangerCard p={p} />
    </>
  )
}

function NeedsChanges({ p, onResend, resending }: { p: VendorProduct; onResend: () => void; resending: boolean }) {
  const r = p.review
  const [appealing, setAppealing] = useState(false)
  const [message, setMessage] = useState("")
  const appeal = useMutation({
    mutationFn: () => appealProduct(p.product.id, message.trim()),
    onSuccess: () => {
      setAppealing(false)
      toast.success("Sent. The team will take a second look.")
    },
    onError: (e) => toast.error((e as { status?: number }).status === 409 ? "You've already asked for a second look." : errText(e)),
  })
  return (
    <div role="status" className="space-y-3 rounded-2xl bg-warning-soft p-4 text-[15px]">
      <p className="flex items-center gap-2 font-bold">
        <HugeiconsIcon icon={Alert02Icon} className="size-5 text-warning" aria-hidden />
        {r?.decision === "reject" ? "Not approved" : "A few things to fix"}
        {r ? <span className="text-sm font-normal text-muted-foreground">· {r.by === "team" ? "from our team" : "automatic check"}</span> : null}
      </p>
      {r?.reasons.length ? (
        <ol className="list-decimal space-y-1.5 pl-5">
          {r.reasons.map((x) => (
            <li key={x.code + x.message}>{x.message}</li>
          ))}
        </ol>
      ) : (
        <p>Update the listing, then send it again.</p>
      )}
      {r?.note ? <p className="rounded-xl bg-background/70 p-3 italic">“{r.note}”</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="brand" size="lg" onClick={onResend} disabled={resending}>
          {resending ? <Spinner /> : null} I've fixed it — send again
        </Button>
        {r?.decision === "reject" && !appealing ? (
          <Button variant="outline" size="lg" onClick={() => setAppealing(true)}>
            Ask for a second look
          </Button>
        ) : null}
      </div>
      {appealing ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (message.trim()) appeal.mutate()
          }}
        >
          <Label htmlFor="appeal-msg">Tell us why it should be approved</Label>
          <Textarea id="appeal-msg" rows={3} value={message} onChange={(e) => setMessage(e.target.value.slice(0, 1000))} className="bg-background text-base" />
          <div className="flex gap-2">
            <Button type="submit" size="lg" disabled={!message.trim() || appeal.isPending}>
              {appeal.isPending ? <Spinner /> : null} Send
            </Button>
            <Button type="button" variant="ghost" size="lg" onClick={() => setAppealing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  )
}

function Banner({ tone, icon, title, children }: { tone: "neutral" | "info" | "warning" | "success"; icon: typeof Clock01Icon; title: string; children?: React.ReactNode }) {
  return (
    <div
      role="status"
      className={cn(
        "flex gap-3 rounded-2xl p-4",
        tone === "info" ? "bg-info-soft" : tone === "warning" ? "bg-warning-soft" : tone === "success" ? "bg-success-soft" : "bg-muted",
      )}
    >
      <HugeiconsIcon
        icon={icon}
        className={cn("mt-0.5 size-5 shrink-0", tone === "info" ? "text-info" : tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "")}
        aria-hidden
      />
      <div className="min-w-0 text-[15px]">
        <p className="font-bold">{title}</p>
        {children ? <div className="text-foreground/80">{children}</div> : null}
      </div>
    </div>
  )
}

function PhotosCard({ p, onSaved }: { p: VendorProduct; onSaved: (n: VendorProduct) => void }) {
  const initial = p.images.length ? p.images.map((i) => i.url) : p.product.imageUrl ? [p.product.imageUrl] : []
  const [photos, setPhotos] = useState(initial)
  const dirty = photos.join("|") !== initial.join("|")
  const save = useMutation({
    mutationFn: () => setImages(p.product.id, photos.map((url) => ({ url }))),
    onSuccess: (n) => {
      onSaved(n)
      toast.success("Photos saved")
    },
    onError: (e) => toast.error(errText(e)),
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Photos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <PhotoPicker value={photos} onChange={setPhotos} />
        {dirty ? (
          <Button onClick={() => save.mutate()} disabled={save.isPending || photos.length === 0} size="lg">
            {save.isPending ? <Spinner /> : null} Save photos
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

function DetailsCard({ p, onSaved }: { p: VendorProduct; onSaved: (n: VendorProduct) => void }) {
  const [title, setTitle] = useState(p.product.title)
  const [description, setDescription] = useState(p.product.description ?? "")
  const [categoryId, setCategoryId] = useState(p.product.primaryCategoryId)
  const dirty = title !== p.product.title || description !== (p.product.description ?? "") || categoryId !== p.product.primaryCategoryId
  const findings = checkListing({ title, description, imageCount: 1, prices: [1], categoryId }).filter((f) => f.field === "title" || f.field === "description")
  const save = useMutation({
    mutationFn: () => updateProduct(p.product.id, { title: title.trim(), description: description.trim() || null, primaryCategoryId: categoryId }),
    onSuccess: (n) => {
      onSaved(n)
      toast.success("Details saved")
    },
    onError: (e) => toast.error(errText(e)),
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="e-title">Product name</Label>
          <Input id="e-title" value={title} onChange={(e) => setTitle(e.target.value.slice(0, 160))} className="h-11 text-base" />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Category</p>
          <CategoryPicker value={categoryId} onChange={setCategoryId} title={title} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="e-desc">Description</Label>
          <Textarea id="e-desc" rows={5} value={description} onChange={(e) => setDescription(e.target.value.slice(0, 5000))} className="text-base" />
        </div>
        {findings.length ? (
          <ul className="space-y-1.5">
            {findings.map((f) => (
              <li key={f.code} className={cn("rounded-xl p-2.5 text-sm", f.severity === "block" ? "bg-danger-soft text-destructive" : f.severity === "fix" ? "bg-warning-soft text-warning" : "bg-muted")}>
                {f.message}
              </li>
            ))}
          </ul>
        ) : null}
        {dirty ? (
          <Button onClick={() => save.mutate()} disabled={save.isPending || title.trim().length < 3} size="lg">
            {save.isPending ? <Spinner /> : null} Save details
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

function StockCard({ p, onSaved }: { p: VendorProduct; onSaved: (n: VendorProduct) => void }) {
  const combos = p.variants.length ? p.variants : [{ variant: p.variant, offer: p.offer, options: {} } as Combo]
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Price & stock</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {combos.map((c) => (
            <StockRow key={c.variant.id} productId={p.product.id} combo={c} single={combos.length === 1} onSaved={onSaved} />
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function StockRow({ productId, combo, single, onSaved }: { productId: string; combo: Combo; single: boolean; onSaved: (n: VendorProduct) => void }) {
  const [price, setPrice] = useState(minorToMajorText(combo.offer.pricePesewas))
  const [qty, setQty] = useState(String(combo.offer.onHand))
  const label = Object.values(combo.options).join(" · ") || "Price and stock"
  const minor = parseMajorToMinor(price)
  const dirty = minor !== combo.offer.pricePesewas || Number(qty) !== combo.offer.onHand
  const save = useMutation({
    mutationFn: (patch: { pricePesewas?: string; onHand?: number; active?: boolean }) => updateVariant(productId, combo.variant.id, patch),
    onSuccess: (n) => {
      onSaved(n)
      toast.success(`${single ? "Saved" : `${label} saved`}`)
    },
    onError: (e) => toast.error(errText(e)),
  })
  const sym = currencySymbol()
  return (
    <li className={cn("space-y-3 py-4 first:pt-0 last:pb-0", !combo.offer.active && "opacity-60")}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">{label}</p>
        {!single ? (
          <label className="flex items-center gap-2 text-sm">
            {combo.offer.active ? "Selling" : "Off"}
            <Switch checked={combo.offer.active} onCheckedChange={(active) => save.mutate({ active })} aria-label={`Sell ${label}`} />
          </label>
        ) : null}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Price ({sym})</span>
          <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className="h-11 w-32 text-base" aria-invalid={!minor || undefined} />
        </label>
        <div className="space-y-1">
          <span className="text-sm font-medium" id={`qty-${combo.variant.id}`}>
            In stock
          </span>
          <div className="flex items-center gap-1" role="group" aria-labelledby={`qty-${combo.variant.id}`}>
            <Button type="button" variant="outline" size="icon-lg" onClick={() => setQty(String(Math.max(0, Number(qty) - 1)))} aria-label="One less">
              <HugeiconsIcon icon={MinusSignIcon} />
            </Button>
            <Input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} className="h-11 w-20 text-center text-base" aria-label="Quantity in stock" />
            <Button type="button" variant="outline" size="icon-lg" onClick={() => setQty(String(Number(qty) + 1))} aria-label="One more">
              <HugeiconsIcon icon={Add01Icon} />
            </Button>
          </div>
        </div>
        {dirty ? (
          <Button size="lg" onClick={() => save.mutate({ pricePesewas: minor ?? undefined, onHand: Number(qty) || 0 })} disabled={save.isPending || !minor}>
            {save.isPending ? <Spinner /> : null} Save
          </Button>
        ) : null}
      </div>
      {combo.offer.reserved > 0 ? <p className="text-sm text-muted-foreground">{combo.offer.reserved} held in checkouts right now.</p> : null}
      {!dirty ? <p className="sr-only">Current price {formatMinor(combo.offer.pricePesewas)}</p> : null}
    </li>
  )
}

function SpecsCard({ p }: { p: VendorProduct }) {
  const id = p.product.id
  const fields = useQuery({ queryKey: ["form-fields", p.product.primaryCategoryId], queryFn: () => formFields(p.product.primaryCategoryId), staleTime: 600_000 })
  const current = useQuery({ queryKey: ["attributes", id], queryFn: () => getAttributes(id) })
  const [values, setValues] = useState<SpecValues | null>(null)
  const loaded: SpecValues = values ?? Object.fromEntries((current.data?.values ?? []).map((v) => [v.definitionId, v]))
  const defs = fields.data?.fields ?? []
  const save = useMutation({
    mutationFn: () => setAttributes(id, Object.values(loaded).filter((v) => {
      const f = defs.find((x) => x.id === v.definitionId)
      return f && isAnswered(f, v)
    })),
    onSuccess: () => {
      setValues(null)
      void current.refetch()
      toast.success("Details saved")
    },
    onError: (e) => toast.error(errText(e)),
  })
  const suggest = useMutation({
    mutationFn: () => suggestAttributes(id),
    onSuccess: (r) => {
      if (!r.suggestions.length) return toast("No suggestions — fill these in yourself.")
      const next = { ...loaded }
      for (const s of r.suggestions) if (!next[s.definitionId]) next[s.definitionId] = s
      setValues(next)
      toast.success(`Filled ${r.suggestions.length} from your title — check them, then save.`)
    },
    onError: (e) => toast.error((e as { status?: number }).status === 501 ? "Suggestions aren't switched on yet." : errText(e)),
  })
  if (fields.isPending || !defs.length) return null
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">Product details</CardTitle>
        <Button variant="outline" size="sm" onClick={() => suggest.mutate()} disabled={suggest.isPending}>
          {suggest.isPending ? <Spinner /> : <HugeiconsIcon icon={MagicWand01Icon} data-icon="inline-start" />} Suggest from my title
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <SpecFields fields={defs} values={loaded} onChange={setValues} />
        {values ? (
          <Button size="lg" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Spinner /> : null} Save details
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

function DangerCard({ p }: { p: VendorProduct }) {
  const navigate = useNavigate()
  const refresh = useRefresh(p.product.id)
  const [confirm, setConfirm] = useState(false)
  const del = useMutation({
    mutationFn: () => deleteProduct(p.product.id),
    onSuccess: () => {
      refresh()
      toast.success("Product deleted")
      void navigate({ to: "/products" })
    },
    onError: (e) => {
      setConfirm(false)
      toast.error((e as { status?: number }).status === 409 ? "It has orders, so it can't be deleted — switch it off instead." : errText(e))
    },
  })
  const hide = useMutation({
    mutationFn: () => updateProduct(p.product.id, { active: false }),
    onSuccess: (n) => {
      refresh(n)
      toast.success("Hidden from buyers")
    },
    onError: (e) => toast.error(errText(e)),
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Stop selling</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button variant="outline" size="lg" onClick={() => hide.mutate()} disabled={hide.isPending}>
          Hide from buyers
        </Button>
        <Button variant="destructive" size="lg" onClick={() => setConfirm(true)}>
          <HugeiconsIcon icon={Delete02Icon} data-icon="inline-start" /> Delete
        </Button>
        <AlertDialog open={confirm} onOpenChange={setConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{p.product.title}”?</AlertDialogTitle>
              <AlertDialogDescription>This removes it for good. If you might sell it again, hide it instead.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault()
                  del.mutate()
                }}
                disabled={del.isPending}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
