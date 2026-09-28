import { useEffect, useMemo, useState } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Alert02Icon, ArrowLeft01Icon, CheckmarkCircle02Icon, InformationCircleIcon } from "@hugeicons/core-free-icons"
import { checkListing, type ListingFinding } from "@alkemart/domain"
import { Button } from "@workspace/console-ui/components/button"
import { Input } from "@workspace/console-ui/components/input"
import { Label } from "@workspace/console-ui/components/label"
import { Progress } from "@workspace/console-ui/components/progress"
import { Spinner } from "@workspace/console-ui/components/spinner"
import { Switch } from "@workspace/console-ui/components/switch"
import { Textarea } from "@workspace/console-ui/components/textarea"
import { ToggleGroup, ToggleGroupItem } from "@workspace/console-ui/components/toggle-group"
import { currencySymbol, formatMinor, parseMajorToMinor } from "@workspace/console-ui/lib/money"
import { cn } from "@workspace/console-ui/lib/utils"
import { CategoryPicker } from "@/components/products/category-picker"
import { OptionsBuilder } from "@/components/products/options-builder"
import { MAX_COMBOS, categoriesKey, combosOf, isAnswered, syncRows, type ComboRow, type OptionDef, type SpecValues } from "@/lib/product-form"
import { PhotoPicker } from "@/components/products/photo-picker"
import { SpecFields } from "@/components/products/spec-fields"
import {
  createProduct,
  flattenCategories,
  formFields,
  listCategories,
  sendForReview,
  setAttributes,
  setImages,
  updateVariant,
} from "@/lib/products"
import { productsKey } from "./products.index"

export const Route = createFileRoute("/_app/products/new")({ component: NewProductPage })

const DRAFT_KEY = "alk.seller.new-product"
const CONDITIONS = [
  { id: "new", label: "New" },
  { id: "used_like_new", label: "Used – like new" },
  { id: "used_good", label: "Used – good" },
  { id: "refurbished", label: "Refurbished" },
] as const

type Draft = {
  photos: string[]
  title: string
  categoryId: string | null
  condition: (typeof CONDITIONS)[number]["id"]
  description: string
  price: string
  qty: string
  hasOptions: boolean
  options: OptionDef[]
  rows: ComboRow[]
  specs: SpecValues
  /** Set once the draft product exists on the server — retries resume from here. */
  productId: string | null
}

const EMPTY: Draft = {
  photos: [],
  title: "",
  categoryId: null,
  condition: "new",
  description: "",
  price: "",
  qty: "1",
  hasOptions: false,
  options: [],
  rows: [],
  specs: {},
  productId: null,
}

function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Draft) } : null
  } catch {
    return null
  }
}

const STEPS = ["Photos", "Basics", "Price & stock", "Review"] as const

function NewProductPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [saved] = useState(readDraft)
  const [d, setD] = useState<Draft>(() => saved ?? EMPTY)
  const [step, setStep] = useState(0)
  const [tried, setTried] = useState(false)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }))

  // Autosave on the device: a dropped connection or closed tab loses nothing.
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(d))
      } catch {
        /* storage full / private mode */
      }
    }, 400)
    return () => window.clearTimeout(t)
  }, [d])

  const cats = useQuery({ queryKey: categoriesKey, queryFn: listCategories, staleTime: 3_600_000 })
  const catName = useMemo(() => flattenCategories(cats.data ?? []).find((c) => c.id === d.categoryId)?.name ?? null, [cats.data, d.categoryId])
  const fields = useQuery({
    queryKey: ["form-fields", d.categoryId],
    queryFn: () => formFields(d.categoryId!),
    enabled: Boolean(d.categoryId),
    staleTime: 600_000,
  })
  const specFields = fields.data?.fields ?? []
  const missingSpecs = specFields.filter((f) => f.required && !isAnswered(f, d.specs[f.id])).map((f) => f.label)

  // Rows follow the options; edits survive option changes.
  const rows = d.hasOptions ? syncRows(d.options, d.rows, d.price, d.qty) : []
  const activeRows = rows.filter((r) => r.on)
  const prices = d.hasOptions
    ? activeRows.map((r) => Number(parseMajorToMinor(r.price) ?? 0))
    : [Number(parseMajorToMinor(d.price) ?? 0)]
  const findings = checkListing({
    title: d.title,
    description: d.description,
    imageCount: d.photos.length,
    prices,
    categoryId: d.categoryId,
    missingRequiredSpecs: missingSpecs,
  })
  const byField = (f: string) => findings.filter((x) => x.field === f)
  const blocks = findings.filter((f) => f.severity === "block")
  const tooMany = d.hasOptions && combosOf(d.options).length > MAX_COMBOS

  const stepOk = [
    d.photos.length > 0,
    d.title.trim().length >= 3 && Boolean(d.categoryId) && !byField("title").some((f) => f.severity === "block"),
    !tooMany && (d.hasOptions ? activeRows.length > 0 && prices.every((p) => p > 0) : prices[0]! > 0) && missingSpecs.length === 0,
    blocks.length === 0,
  ]

  const publish = useMutation({
    mutationFn: async (mode: "review" | "draft") => {
      let productId = d.productId
      if (!productId) {
        const created = await createProduct({
          title: d.title.trim(),
          description: d.description.trim() || null,
          primaryCategoryId: d.categoryId!,
          pricePesewas: d.hasOptions ? parseMajorToMinor(activeRows[0]?.price ?? "") ?? "0" : parseMajorToMinor(d.price) ?? "0",
          onHand: Number(d.hasOptions ? activeRows[0]?.qty : d.qty) || 0,
          imageUrl: d.photos[0] ?? null,
          draft: true,
          ...(d.hasOptions
            ? {
                variant_options: d.options.filter((o) => o.name.trim() && o.values.length).map((o) => ({ name: o.name.trim(), values: o.values })),
                variant_entries: rows.map((r) => ({
                  options: r.options,
                  pricePesewas: parseMajorToMinor(r.price) ?? undefined,
                  quantity: r.on ? Number(r.qty) || 0 : 0,
                })),
              }
            : {}),
        })
        productId = created.product.id
        setD((x) => ({ ...x, productId }))
      }
      // Idempotent follow-ups: safe to repeat if a retry resumes here.
      const product = await setImages(productId, d.photos.map((url) => ({ url })))
      const specValues = Object.values(d.specs).filter((v) => {
        const f = specFields.find((x) => x.id === v.definitionId)
        return f && isAnswered(f, v)
      })
      if (specValues.length) await setAttributes(productId, specValues)
      const combos = product.variants.length ? product.variants : [{ variant: product.variant, offer: product.offer, options: {} }]
      for (const c of combos) {
        const row = rows.find((r) => Object.entries(r.options).every(([k, v]) => c.options[k] === v))
        const patch: { condition?: string; active?: boolean } = {}
        if (d.condition !== "new" || c.offer.condition !== "new") patch.condition = d.condition
        if (row && !row.on && c.offer.active) patch.active = false
        if (Object.keys(patch).length) await updateVariant(productId, c.variant.id, patch)
      }
      const decision = mode === "review" ? ((await sendForReview(productId)) as { review?: { decision: string } | null }).review?.decision : undefined
      return { productId, mode, decision }
    },
    onSuccess: ({ productId, mode, decision }) => {
      try {
        localStorage.removeItem(DRAFT_KEY)
      } catch {
        /* ignore */
      }
      void qc.invalidateQueries({ queryKey: productsKey })
      toast.success(
        mode === "draft"
          ? "Saved as a draft."
          : decision === "approve"
            ? "It's live! Buyers can find it now."
            : decision === "request_changes"
              ? "A few things need fixing — see the list on the product."
              : "Sent for a quick check — you'll see the result in Products.",
      )
      void navigate({ to: "/products/$id", params: { id: productId } })
    },
  })

  const next = () => {
    setTried(true)
    if (!stepOk[step]) {
      document.querySelector<HTMLElement>("[aria-invalid=true], [data-first-error]")?.focus()
      return
    }
    setTried(false)
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
    window.scrollTo({ top: 0 })
  }
  const sym = currencySymbol()

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-32 lg:pb-8">
      <div className="space-y-3">
        <Link to="/products" className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-semibold text-muted-foreground hover:text-foreground">
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-5" aria-hidden /> Products
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-[1.75rem]">Add a product</h1>
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground" aria-live="polite">
            Step {step + 1} of {STEPS.length}: <span className="text-foreground">{STEPS[step]}</span>
          </p>
          <Progress value={((step + 1) / STEPS.length) * 100} aria-label="Progress" />
        </div>
        {saved && step === 0 && (saved.title || saved.photos.length) ? (
          <p className="flex items-center justify-between gap-3 rounded-xl bg-info-soft p-3 text-sm text-info">
            <span>We kept your unfinished product from last time.</span>
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => {
                setD(EMPTY)
                localStorage.removeItem(DRAFT_KEY)
              }}
            >
              Start fresh
            </button>
          </p>
        ) : null}
      </div>

      {step === 0 ? (
        <section aria-labelledby="s-photos" className="space-y-3 rounded-2xl border bg-card p-4 sm:p-6">
          <h2 id="s-photos" className="text-lg font-bold">
            Photos
          </h2>
          <PhotoPicker value={d.photos} onChange={(v) => setD((x) => ({ ...x, photos: typeof v === "function" ? v(x.photos) : v }))} />
          {tried && !d.photos.length ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              Add at least one photo to continue.
            </p>
          ) : null}
        </section>
      ) : null}

      {step === 1 ? (
        <section aria-labelledby="s-basics" className="space-y-5 rounded-2xl border bg-card p-4 sm:p-6">
          <h2 id="s-basics" className="text-lg font-bold">
            Basics
          </h2>
          <div className="space-y-2">
            <Label htmlFor="title">Product name</Label>
            <Input
              id="title"
              value={d.title}
              onChange={(e) => set("title", e.target.value.slice(0, 160))}
              placeholder="e.g. Tecno Spark 20 Pro 256GB, black"
              aria-invalid={(tried && d.title.trim().length < 3) || byField("title").some((f) => f.severity === "block") || undefined}
              aria-describedby="title-hints"
              className="h-12 text-base"
            />
            <div id="title-hints">
              <Hints items={byField("title")} fallback="Brand, model, size or colour — what a buyer would search for." />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium" id="cat-label">
              Category
            </p>
            <CategoryPicker value={d.categoryId} onChange={(id) => setD((x) => ({ ...x, categoryId: id, specs: {} }))} title={d.title} />
            {tried && !d.categoryId ? <p className="text-sm text-destructive">Choose a category to continue.</p> : null}
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Condition</legend>
            <ToggleGroup type="single" variant="outline" value={d.condition} onValueChange={(v) => v && set("condition", v as Draft["condition"])} className="flex-wrap justify-start">
              {CONDITIONS.map((c) => (
                <ToggleGroupItem key={c.id} value={c.id} className="min-h-10 px-3.5">
                  {c.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor="desc">
              Description <span className="font-normal text-muted-foreground">(optional, but it helps)</span>
            </Label>
            <Textarea
              id="desc"
              rows={5}
              value={d.description}
              onChange={(e) => set("description", e.target.value.slice(0, 5000))}
              placeholder="Condition, size, what's in the box, warranty…"
              className="text-base"
            />
            <Hints items={byField("description")} />
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section aria-labelledby="s-price" className="space-y-5 rounded-2xl border bg-card p-4 sm:p-6">
          <h2 id="s-price" className="text-lg font-bold">
            Price & stock
          </h2>
          <div className="flex items-center justify-between gap-4 rounded-xl bg-muted p-3">
            <Label htmlFor="has-options" className="flex-col items-start gap-0.5">
              <span className="font-semibold">Comes in options?</span>
              <span className="text-sm font-normal text-muted-foreground">Different sizes, colours or storage — each with its own price and stock.</span>
            </Label>
            <Switch id="has-options" checked={d.hasOptions} onCheckedChange={(v) => setD((x) => ({ ...x, hasOptions: v, options: v && !x.options.length ? [{ name: "", values: [] }] : x.options }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="price">{d.hasOptions ? "Starting price" : "Price"}</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{sym}</span>
                <Input
                  id="price"
                  inputMode="decimal"
                  value={d.price}
                  onChange={(e) => set("price", e.target.value)}
                  placeholder="0.00"
                  aria-invalid={(tried && !d.hasOptions && !(prices[0]! > 0)) || undefined}
                  className="h-12 text-base"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="qty">{d.hasOptions ? "Stock each" : "How many do you have?"}</Label>
              <Input id="qty" inputMode="numeric" value={d.qty} onChange={(e) => set("qty", e.target.value.replace(/\D/g, ""))} className="h-12 text-base" />
            </div>
          </div>
          {d.hasOptions ? (
            <OptionsBuilder
              options={d.options}
              onOptions={(options) => setD((x) => ({ ...x, options }))}
              rows={rows}
              onRows={(r) => setD((x) => ({ ...x, rows: r }))}
              currencySymbol={sym}
            />
          ) : null}
          <Hints items={byField("price")} />

          {d.categoryId && specFields.length ? (
            <div className="space-y-3 border-t pt-5">
              <div>
                <h3 className="font-semibold">Details for {catName ?? "this category"}</h3>
                <p className="text-sm text-muted-foreground">Buyers filter by these — filled-in details get found more.</p>
              </div>
              <SpecFields fields={specFields} values={d.specs} onChange={(specs) => set("specs", specs)} showErrors={tried} />
            </div>
          ) : null}
        </section>
      ) : null}

      {step === 3 ? (
        <section aria-labelledby="s-review" className="space-y-5 rounded-2xl border bg-card p-4 sm:p-6">
          <h2 id="s-review" className="text-lg font-bold">
            Check and publish
          </h2>
          <div className="flex gap-4 rounded-2xl bg-surface p-3">
            {d.photos[0] ? <img src={d.photos[0]} alt="" className="size-24 shrink-0 rounded-xl object-cover" /> : null}
            <div className="min-w-0 space-y-1">
              <p className="line-clamp-2 font-semibold">{d.title || "Untitled"}</p>
              <p className="text-lg font-extrabold tabular">
                {prices.length && prices.every((p) => p > 0)
                  ? Math.min(...prices) === Math.max(...prices)
                    ? formatMinor(prices[0])
                    : `${formatMinor(Math.min(...prices))} – ${formatMinor(Math.max(...prices))}`
                  : "—"}
              </p>
              <p className="text-sm text-muted-foreground">
                {catName ?? "No category"} · {CONDITIONS.find((c) => c.id === d.condition)?.label}
                {d.hasOptions ? ` · ${activeRows.length} options` : ""}
              </p>
            </div>
          </div>
          {findings.length === 0 ? (
            <p className="flex items-center gap-2 rounded-xl bg-success-soft p-3 font-semibold text-success">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-5" aria-hidden /> Looks great — ready for review.
            </p>
          ) : (
            <Hints items={findings} />
          )}
          <p className="text-sm text-muted-foreground">
            Every new product is checked before buyers see it. You'll find the result in Products — if anything needs changing, we'll say exactly what.
          </p>
          {publish.isError ? (
            <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm font-medium text-destructive">
              {(publish.error as { status?: number }).status == null
                ? "No connection — your product is saved on this phone. Try again when you're back online."
                : (publish.error as Error).message}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Sticky actions: thumb reach on phones, above the tab bar. */}
      <div className="fixed inset-x-0 bottom-16 z-20 flex gap-2 border-t bg-background/95 p-3 pb-safe backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0">
        {step > 0 ? (
          <Button type="button" variant="outline" size="xl" onClick={() => setStep((s) => s - 1)} disabled={publish.isPending} className="px-4 sm:px-6">
            <HugeiconsIcon icon={ArrowLeft01Icon} aria-hidden />
            <span className="sr-only sm:not-sr-only">Back</span>
          </Button>
        ) : null}
        {step < STEPS.length - 1 ? (
          <Button type="button" variant="brand" size="xl" className="flex-1" onClick={next}>
            Next: {STEPS[step + 1]}
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" size="xl" onClick={() => publish.mutate("draft")} disabled={publish.isPending} className="px-4 sm:px-6">
              Save draft
            </Button>
            <Button type="button" variant="brand" size="xl" className="min-w-0 flex-1 px-4" onClick={() => publish.mutate("review")} disabled={publish.isPending || blocks.length > 0}>
              {publish.isPending ? <Spinner /> : null}
              Publish
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

function Hints({ items, fallback }: { items: ListingFinding[]; fallback?: string }) {
  if (!items.length) return fallback ? <p className="text-sm text-muted-foreground">{fallback}</p> : null
  return (
    <ul className="space-y-1.5">
      {items.map((f) => (
        <li
          key={f.code}
          className={cn(
            "flex gap-2 rounded-xl p-2.5 text-sm",
            f.severity === "block" ? "bg-danger-soft text-destructive" : f.severity === "fix" ? "bg-warning-soft text-warning" : "bg-muted text-foreground",
          )}
        >
          <HugeiconsIcon icon={f.severity === "tip" ? InformationCircleIcon : Alert02Icon} className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{f.message}</span>
        </li>
      ))}
    </ul>
  )
}
