import { useState } from "react"
import { CaretDown, CaretUp, CheckCircle, Clock, Storefront, X } from "@phosphor-icons/react"
import {
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StoreCardArt,
  StoreCardFacts,
  StudioImageField,
  StudioWorkbench,
  storeCardShell,
  type StudioDevice,
} from "@workspace/ui"
import { toast } from "sonner"
import { DELIVERY_MINUTE_BANDS } from "@alkemart/shared/storefront-badges"
import { products as productsApi } from "../lib/api"
import {
  useCategories,
  useFeatured,
  useProducts,
  useSellerProfile,
  useSetFeatured,
  useUpdateDelivery,
  useUpdateDisplay,
  useUpdateSeller,
} from "../lib/hooks"

const NONE = "__none"
type Beat = "window" | "picks" | "delivery" | "display"

/**
 * Vendor shop window — same three-zone workbench as Homepage Studio,
 * scoped to what a seller actually controls: banner, eight picks, delivery
 * band, category order.
 */
export function ShopStudio() {
  const [beat, setBeat] = useState<Beat>("window")
  const [device, setDevice] = useState<StudioDevice>("mobile")
  const { data: profile } = useSellerProfile()
  const seller = profile?.seller
  const { data: featuredData } = useFeatured()
  const { data: productsData } = useProducts({ limit: 100 })
  const picks = featuredData?.productIds ?? []
  const catalog = productsData?.products ?? []
  const featuredThumbs = picks
    .map((id) => catalog.find((product) => product.id === id))
    .filter(Boolean)
    .slice(0, 8)

  return (
    <StudioWorkbench
      className="min-h-[70vh] overflow-hidden rounded-lg border border-border"
      device={device}
      onDevice={setDevice}
      toolbar={<p className="text-sm font-extrabold">Shop window</p>}
      outline={
        <nav className="flex flex-col gap-1 p-3" aria-label="Shop window beats">
          {([
            ["window", "Banner & name"],
            ["picks", "Eight picks"],
            ["delivery", "Delivery band"],
            ["display", "Catalog order"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setBeat(id)}
              className={`rounded-lg border px-3 py-2 text-left text-sm font-bold ${
                beat === id ? "border-primary bg-white shadow-xs" : "border-transparent hover:bg-muted/60"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      }
      canvas={
        <div className="p-3">
          <div className={storeCardShell}>
            <StoreCardArt
              src={seller?.banner ?? seller?.logo}
              className="aspect-[4/3]"
              fallback={<Storefront className="h-8 w-8" aria-hidden />}
            />
            <div className="flex flex-col gap-1 p-3">
              <span className="truncate text-sm font-bold tracking-tight">{seller?.name ?? "Your shop"}</span>
              {seller?.storefront?.tagline ? (
                <span className="truncate text-xs text-muted-foreground">{seller.storefront.tagline}</span>
              ) : null}
              <StoreCardFacts
                store={{
                  deliveryMinutes: seller?.delivery?.minutes ?? null,
                }}
              />
              {featuredThumbs.length ? (
                <div className="mt-2 flex gap-1.5 overflow-hidden">
                  {featuredThumbs.map((product) => (
                    <span key={product!.id} className="size-12 overflow-hidden rounded-lg bg-muted">
                      {product!.thumbnail ? (
                        <img src={product!.thumbnail} alt="" className="size-full object-cover" />
                      ) : null}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">Pick up to 8 products — they lead the shop card.</p>
              )}
            </div>
          </div>
        </div>
      }
      inspector={
        beat === "window" ? <WindowPane /> :
        beat === "picks" ? <PicksPane /> :
        beat === "delivery" ? <DeliveryPane /> :
        <DisplayPane />
      }
    />
  )
}

function WindowPane() {
  const { data } = useSellerProfile()
  const update = useUpdateSeller()
  const seller = data?.seller
  const [banner, setBanner] = useState<string | null | undefined>(undefined)
  const [logo, setLogo] = useState<string | null | undefined>(undefined)
  const bannerValue = banner === undefined ? seller?.banner ?? "" : banner ?? ""
  const logoValue = logo === undefined ? seller?.logo ?? "" : logo ?? ""
  const dirty = banner !== undefined || logo !== undefined

  const upload = (file: File) => productsApi.upload(file)

  const save = async () => {
    try {
      await update.mutateAsync({
        banner: banner !== undefined ? banner : undefined,
        logo: logo !== undefined ? logo : undefined,
      })
      setBanner(undefined)
      setLogo(undefined)
      toast.success("Shop art saved.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save art.")
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-sm font-extrabold">Banner & mark</p>
      <p className="text-xs text-muted-foreground">Art only — no text on the photo. Caption is your shop name, below.</p>
      <StudioImageField
        label="Banner"
        ratio="landscape"
        value={bannerValue}
        onValueChange={(value) => setBanner(value || null)}
        onUpload={upload}
      />
      <StudioImageField
        label="Logo"
        ratio="square"
        value={logoValue}
        onValueChange={(value) => setLogo(value || null)}
        onUpload={upload}
      />
      <Button type="button" disabled={!dirty || update.isPending} onClick={() => void save()}>
        {update.isPending ? "Saving…" : "Save art"}
      </Button>
    </div>
  )
}

function PicksPane() {
  const { data: featuredData } = useFeatured()
  const { data: productsData } = useProducts({ limit: 100 })
  const save = useSetFeatured()
  const savedIds = featuredData?.productIds ?? []
  const allProducts = productsData?.products ?? []
  const [ids, setIds] = useState<string[] | null>(null)
  const value = ids ?? savedIds
  const dirty = ids !== null
  const titleOf = (id: string) => allProducts.find((p) => p.id === id)?.title ?? id

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...value]
    const j = idx + dir
    if (j < 0 || j >= next.length) return
    const [item] = next.splice(idx, 1)
    next.splice(j, 0, item!)
    setIds(next)
  }

  const toggle = (id: string) => {
    if (value.includes(id)) setIds(value.filter((x) => x !== id))
    else if (value.length >= 8) toast.error("The window holds at most 8 products.")
    else setIds([...value, id])
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-sm font-extrabold">Eight picks <span className="font-normal text-muted-foreground tabular-nums">{value.length}/8</span></p>
      {value.length ? (
        <ol className="space-y-1">
          {value.map((id, i) => (
            <li key={id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium">
              <span className="font-bold text-primary tabular-nums">#{i + 1}</span>
              <span className="flex-1 truncate">{titleOf(id)}</span>
              <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="px-1 disabled:opacity-30"><CaretUp size={12} weight="bold" /></button>
              <button type="button" aria-label="Move down" disabled={i === value.length - 1} onClick={() => move(i, 1)} className="px-1 disabled:opacity-30"><CaretDown size={12} weight="bold" /></button>
              <button type="button" aria-label="Remove" onClick={() => toggle(id)} className="px-1 text-destructive"><X size={12} weight="bold" /></button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-xs text-muted-foreground">Tick products below. Rank 1 leads the shop card.</p>
      )}
      <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-2">
        {allProducts.map((p) => (
          <li key={p.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60">
              <input type="checkbox" checked={value.includes(p.id)} onChange={() => toggle(p.id)} />
              <span className="truncate">{p.title}</span>
            </label>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        disabled={!dirty || save.isPending}
        onClick={async () => {
          try {
            await save.mutateAsync(value)
            setIds(null)
            toast.success("Picks published.")
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to save picks.")
          }
        }}
      >
        Save picks
      </Button>
    </div>
  )
}

function DeliveryPane() {
  const { data } = useSellerProfile()
  const saved = data?.seller?.delivery?.minutes ?? null
  const update = useUpdateDelivery()
  const [value, setValue] = useState<number | null | undefined>(undefined)
  const current = value === undefined ? saved : value
  const dirty = value !== undefined && value !== saved

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="flex items-center gap-2 text-sm font-extrabold"><Clock className="h-4 w-4" aria-hidden /> Delivery band</p>
      <p className="text-xs text-muted-foreground">The time you can keep on a busy day. Unset shows no time — not a fake default.</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Delivery time band">
        <button
          type="button"
          onClick={() => setValue(null)}
          aria-pressed={current == null}
          className={`h-10 rounded-lg border px-3.5 text-sm font-bold ${current == null ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground"}`}
        >
          Not set
        </button>
        {DELIVERY_MINUTE_BANDS.map((band) => (
          <button
            key={band}
            type="button"
            onClick={() => setValue(band)}
            aria-pressed={current === band}
            className={`h-10 rounded-lg border px-3.5 text-sm font-bold tabular-nums ${current === band ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
          >
            {band} min
          </button>
        ))}
      </div>
      {current != null && current <= 30 ? (
        <p className="flex items-center gap-2 text-sm font-bold text-success"><CheckCircle className="h-4 w-4" /> Earns Fast delivery.</p>
      ) : null}
      <Button
        type="button"
        disabled={!dirty || update.isPending}
        onClick={async () => {
          try {
            await update.mutateAsync(current ?? null)
            setValue(undefined)
            toast.success(current == null ? "Delivery time cleared." : `Delivery time set to ${current} minutes.`)
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not save delivery time.")
          }
        }}
      >
        Save delivery
      </Button>
    </div>
  )
}

function DisplayPane() {
  const { data: profile } = useSellerProfile()
  const { data: categoriesData } = useCategories()
  const update = useUpdateDisplay()
  const categories = categoriesData?.product_categories ?? []
  const savedOrder = profile?.seller?.display?.categoryOrder ?? []
  const savedFeaturedCat = profile?.seller?.display?.featuredCategoryId ?? ""
  const [order, setOrder] = useState<string[] | null>(null)
  const [featuredCat, setFeaturedCat] = useState<string | null>(null)
  const orderValue = order ?? savedOrder
  const featuredValue = featuredCat ?? savedFeaturedCat
  const dirty = order !== null || featuredCat !== null
  const nameOf = (id: string) => categories.find((c) => c.id === id)?.name ?? id
  const [addId, setAddId] = useState("")

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...orderValue]
    const j = idx + dir
    if (j < 0 || j >= next.length) return
    const [item] = next.splice(idx, 1)
    next.splice(j, 0, item!)
    setOrder(next)
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-sm font-extrabold">Catalog order</p>
      <div className="space-y-2">
        <Label htmlFor="studio-featured-cat">Featured category</Label>
        <Select value={featuredValue || NONE} onValueChange={(v) => setFeaturedCat(v === NONE ? "" : v)}>
          <SelectTrigger id="studio-featured-cat"><SelectValue placeholder="None" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>None</SelectItem>
            {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {orderValue.length ? (
        <ul className="space-y-1">
          {orderValue.map((id, i) => (
            <li key={id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium">
              <span className="tabular-nums text-muted-foreground">{i + 1}.</span>
              <span className="flex-1 truncate">{nameOf(id)}</span>
              <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="px-1 disabled:opacity-30"><CaretUp size={12} weight="bold" /></button>
              <button type="button" aria-label="Move down" disabled={i === orderValue.length - 1} onClick={() => move(i, 1)} className="px-1 disabled:opacity-30"><CaretDown size={12} weight="bold" /></button>
              <button type="button" aria-label="Remove" onClick={() => setOrder(orderValue.filter((x) => x !== id))} className="px-1 text-destructive"><X size={12} weight="bold" /></button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Default taxonomy order.</p>
      )}
      <div className="flex gap-2">
        <Select value={addId} onValueChange={setAddId}>
          <SelectTrigger aria-label="Add category" className="flex-1"><SelectValue placeholder="Add a category…" /></SelectTrigger>
          <SelectContent>
            {categories.filter((c) => !orderValue.includes(c.id)).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" disabled={!addId} onClick={() => { if (addId) { setOrder([...orderValue, addId]); setAddId("") } }}>Add</Button>
      </div>
      <Button
        type="button"
        disabled={!dirty || update.isPending}
        onClick={async () => {
          try {
            await update.mutateAsync({
              categoryOrder: order ?? undefined,
              featuredCategoryId: featuredCat !== null ? (featuredCat === "" ? null : featuredCat) : undefined,
            })
            setOrder(null)
            setFeaturedCat(null)
            toast.success("Catalog display saved.")
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to save display.")
          }
        }}
      >
        Save display
      </Button>
    </div>
  )
}
