import type { HomeSection, HomeTheme } from "@alkemart/shared/homepage"
import { isSectionVisible } from "@alkemart/shared/homepage"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { ArrowsDownUp, Copy, Eye, FloppyDisk, Plus, RocketLaunch, Trash } from "@phosphor-icons/react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button, Input, MerchEmpty, MerchGridSection, MerchPromoBand, MerchPromoGrid, MerchPromoHero, MerchShelf, MerchValueGrid, Skeleton, Textarea, cn } from "@workspace/ui"
import { PageHeader } from "../../components/page-header"
import { PageShell } from "../../components/page-shell"
import { homepageStudio } from "../../lib/api"

export const Route = createFileRoute("/_authenticated/homepage")({ component: HomepageStudioPage })

const sectionLabels: Record<HomeSection["type"], string> = {
  promo_hero: "Promo banner",
  promo_grid: "Promo grid",
  category_grid: "Category grid",
  product_shelf: "Product shelf",
  promo_band: "Promo band",
  value_grid: "Value grid",
}

const sectionHints: Record<HomeSection["type"], string> = {
  promo_hero: "One strong seasonal message. Walmart pattern: large feature area above the fold.",
  promo_grid: "2–8 campaign tiles. Use Bento to feature one campaign large, like Amazon split sections.",
  category_grid: "Real catalogue categories. Tiles = clarity, Mosaic = bento feature, Rail = compact scroll nav.",
  product_shelf: "Featured = hand-picked rail, Latest = newest, Category = scoped, Manual = explicit product IDs.",
  promo_band: "Compact CTA strip (seller callout, delivery promise, seasonal notice). Replaces code-only bands.",
  value_grid: "Trust messages: delivery, cash on delivery, trusted sellers.",
}

function newSection(type: HomeSection["type"]): HomeSection {
  const id = `${type}-${crypto.randomUUID().slice(0, 8)}`
  if (type === "promo_hero") return { id, type, title: "A brighter way to shop", subtitle: "Seasonal picks from sellers across Ghana.", body: "Discover useful finds from sellers across Ghana.", theme: "gold", layout: "split", action: { label: "Shop now", href: "/categories/all" }, visible: true }
  if (type === "promo_grid") return { id, type, title: "Today on Alkemart", subtitle: "Curated campaigns.", columns: 2, theme: "white", variant: "cards", tiles: [{ id: `${id}-1`, title: "Featured collection", body: "Add campaign copy here.", href: "/categories/all" }], visible: true }
  if (type === "category_grid") return { id, type, title: "Shop by category", subtitle: "Browse the departments buyers use most.", columns: 4, variant: "tiles", showAllLink: true, categoryIds: [], visible: true }
  if (type === "product_shelf") return { id, type, title: "Fresh picks", subtitle: "Just landed from our sellers.", source: "featured", limit: 8, layout: "grid", visible: true }
  if (type === "promo_band") return { id, type, title: "Sell on Alkemart", body: "Open a shop and list products for buyers nationwide.", theme: "gold", action: { label: "Start selling", href: "/sell" }, secondaryAction: { label: "How selling works", href: "/sell" }, visible: true }
  return { id, type, title: "Why shop Alkemart", items: [{ id: `${id}-1`, title: "Local sellers", body: "Shop from businesses across Ghana." }, { id: `${id}-2`, title: "Flexible delivery", body: "Choose an option that works for you." }], visible: true }
}

function toDateTimeLocal(iso: string | null | undefined): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromDateTimeLocal(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function HomepageStudioPage() {
  const queryClient = useQueryClient()
  const pageQ = useQuery({ queryKey: ["homepage-studio"], queryFn: homepageStudio.get })
  const categoriesQ = useQuery({ queryKey: ["homepage-studio", "categories"], queryFn: homepageStudio.categories })
  const [sections, setSections] = useState<HomeSection[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop")
  const [publishAt, setPublishAt] = useState("")
  const [unpublishAt, setUnpublishAt] = useState("")

  useEffect(() => {
    if (!pageQ.data) return
    setSections(pageQ.data.sections)
    setSelectedId((current) => current ?? pageQ.data.sections[0]?.id ?? null)
  }, [pageQ.data])

  const selected = useMemo(() => sections.find((section) => section.id === selectedId) ?? null, [sections, selectedId])
  const now = useMemo(() => new Date(), [])
  const hiddenCount = useMemo(() => sections.filter((section) => !isSectionVisible(section, now)).length, [sections, now])
  const save = useMutation({
    mutationFn: () => homepageStudio.saveDraft(pageQ.data!.revision, sections),
    onSuccess: (page) => { queryClient.setQueryData(["homepage-studio"], page); toast.success("Draft saved") },
    onError: (error: Error) => toast.error(error.message),
  })
  const publish = useMutation({
    mutationFn: async () => {
      const saved = await homepageStudio.saveDraft(pageQ.data!.revision, sections)
      const ends = unpublishAt ? new Date(unpublishAt).toISOString() : null
      return publishAt
        ? homepageStudio.schedule(saved.revision, new Date(publishAt).toISOString(), ends)
        : homepageStudio.publish(saved.revision, ends)
    },
    onSuccess: (page) => { queryClient.setQueryData(["homepage-studio"], page); toast.success(publishAt ? "Homepage scheduled" : "Homepage published") },
    onError: (error: Error) => toast.error(error.message),
  })

  const update = (next: HomeSection) => setSections((items) => items.map((item) => item.id === next.id ? next : item))
  const move = (id: string, delta: number) => setSections((items) => {
    const from = items.findIndex((item) => item.id === id); const to = from + delta
    if (from < 0 || to < 0 || to >= items.length) return items
    const next = [...items]; const [item] = next.splice(from, 1); if (item) next.splice(to, 0, item); return next
  })
  const duplicate = (id: string) => {
    const source = sections.find((item) => item.id === id)
    if (!source) return
    const copy = structuredClone(source) as HomeSection
    const nextId = `${source.type}-${crypto.randomUUID().slice(0, 8)}`
    const remap = (value: string, suffix: string) => value.replace(source.id, nextId).replace(/-[0-9a-f]{6,8}$/, `-${suffix}`)
    const clone: HomeSection = { ...copy, id: nextId } as HomeSection
    if (clone.type === "promo_grid") clone.tiles = clone.tiles.map((tile) => ({ ...tile, id: remap(tile.id, crypto.randomUUID().slice(0, 6)) }))
    if (clone.type === "value_grid") clone.items = clone.items.map((item) => ({ ...item, id: remap(item.id, crypto.randomUUID().slice(0, 6)) }))
    setSections((items) => {
      const index = items.findIndex((item) => item.id === id)
      const next = [...items]
      next.splice(index + 1, 0, clone)
      return next
    })
    setSelectedId(nextId)
    toast.success("Section duplicated")
  }

  if (pageQ.isLoading) return <PageShell><Skeleton className="h-[70vh] rounded-2xl" /></PageShell>
  if (!pageQ.data) return <PageShell><p>Homepage Studio could not be loaded.</p></PageShell>

  return (
    <PageShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <PageHeader title="Homepage Studio" description="Build, preview, schedule, and publish the storefront homepage. Sections follow the Walmart grid-first order: banner → category tiles → product shelves → promo grids → band." />
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-black px-3 py-2 text-xs font-bold capitalize text-white">{pageQ.data.status}</span>
          {hiddenCount ? <span className="rounded-full bg-amber-100 px-3 py-2 text-xs font-bold text-amber-900">{hiddenCount} hidden / scheduled</span> : null}
          <Input aria-label="Schedule publish time" title="Publish at" type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} className="w-52" />
          <Input aria-label="Schedule end time" title="Unpublish at" type="datetime-local" value={unpublishAt} onChange={(e) => setUnpublishAt(e.target.value)} className="w-52" />
          <Button variant="outline" onClick={() => save.mutate()} disabled={save.isPending}><FloppyDisk className="mr-2 h-4 w-4" />Save draft</Button>
          <Button onClick={() => publish.mutate()} disabled={publish.isPending}><RocketLaunch className="mr-2 h-4 w-4" />{publishAt ? "Schedule" : "Publish"}</Button>
        </div>
      </div>

      <div className="grid min-h-[720px] grid-cols-1 overflow-hidden rounded-2xl border border-black/10 bg-white xl:grid-cols-[260px_minmax(0,1fr)_330px]">
        <aside className="border-b border-black/10 p-4 xl:border-b-0 xl:border-r">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Sections ({sections.length}/24)</p>
          <div className="space-y-2">
            {sections.map((section, index) => {
              const live = isSectionVisible(section, now)
              return (
                <div key={section.id} className={cn("flex w-full items-center gap-2 rounded-xl border p-3 text-left text-sm font-semibold", selectedId === section.id ? "border-primary bg-primary/10" : "border-black/10 hover:border-black/25")}>
                  <button className="flex min-w-0 flex-1 items-center gap-2" onClick={() => setSelectedId(section.id)}>
                    <ArrowsDownUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{"title" in section && section.title ? section.title : sectionLabels[section.type]}</span>
                    <span className="text-xs text-muted-foreground">{index + 1}</span>
                  </button>
                  {!live ? <span title="Hidden or scheduled out of window" className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-bold uppercase">off</span> : null}
                  <button title="Duplicate section" aria-label={`Duplicate ${sectionLabels[section.type]}`} onClick={() => duplicate(section.id)}><Copy className="h-4 w-4 text-muted-foreground hover:text-black" /></button>
                </div>
              )
            })}
            {!sections.length ? <MerchEmpty title="No sections yet" body="Add a promo banner, category grid, or product shelf to start merchandising." /> : null}
          </div>
          <div className="mt-5 space-y-2 border-t border-black/10 pt-4">
            {(Object.keys(sectionLabels) as HomeSection["type"][]).map((type) => <Button key={type} variant="outline" size="sm" className="w-full justify-start" disabled={sections.length >= 24} onClick={() => { const section = newSection(type); setSections((items) => [...items, section]); setSelectedId(section.id) }}><Plus className="mr-2 h-4 w-4" />{sectionLabels[type]}</Button>)}
          </div>
        </aside>

        <main className="bg-[#f4f4f4] p-4 sm:p-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-semibold"><Eye className="h-4 w-4" />Live preview — same components as the storefront</span>
            <div className="rounded-lg border bg-white p-1"><button className={cn("rounded-md px-3 py-1 text-xs", device === "desktop" && "bg-black text-white")} onClick={() => setDevice("desktop")}>Desktop</button><button className={cn("rounded-md px-3 py-1 text-xs", device === "mobile" && "bg-black text-white")} onClick={() => setDevice("mobile")}>Mobile</button></div>
          </div>
          <div className={cn("mx-auto min-h-[620px] overflow-hidden rounded-xl border bg-white shadow-sm transition-all", device === "mobile" ? "max-w-[390px]" : "max-w-5xl")}>
            <StudioPreview sections={sections} categoryNames={new Map((categoriesQ.data?.categories ?? []).flatMap((category) => [[category.id, category.name] as const, ...((category.children ?? []).map((child) => [child.id, child.name] as const))]))} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Buyer view: the storefront hides sections marked invisible or outside their start/end window. <a className="font-bold underline" href="/" target="_blank" rel="noreferrer">Open storefront</a></p>
        </main>

        <aside className="border-t border-black/10 p-4 xl:border-l xl:border-t-0">
          {selected ? <SectionEditor section={selected} categories={(categoriesQ.data?.categories ?? []).flatMap((category) => [category, ...(category.children ?? [])])} onChange={update} onDelete={() => { setSections((items) => items.filter((item) => item.id !== selected.id)); setSelectedId(null) }} onMove={(delta) => move(selected.id, delta)} onDuplicate={() => duplicate(selected.id)} /> : <p className="text-sm text-muted-foreground">Select a section to edit it.</p>}
        </aside>
      </div>
    </PageShell>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5 text-sm font-semibold"><span>{label}</span>{children}{hint ? <span className="block text-xs font-normal text-muted-foreground">{hint}</span> : null}</label>
}
function ThemeField({ value, onChange }: { value: HomeTheme; onChange: (value: HomeTheme) => void }) { return <Field label="Theme"><select className="h-10 w-full rounded-lg border border-input bg-white px-3" value={value} onChange={(e) => onChange(e.target.value as HomeTheme)}><option value="white">White</option><option value="gold">Gold</option><option value="black">Black</option></select></Field> }
function VisibilityFields({ section, onChange }: { section: HomeSection; onChange: (section: HomeSection) => void }) {
  return (
    <div className="space-y-3 rounded-xl border border-dashed p-3">
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={section.visible !== false} onChange={(e) => onChange({ ...section, visible: e.target.checked } as HomeSection)} /> Visible on storefront</label>
      <Field label="Start (optional)" hint="Seasonal start. Empty = show immediately."><Input type="datetime-local" value={toDateTimeLocal(section.startsAt)} onChange={(e) => onChange({ ...section, startsAt: fromDateTimeLocal(e.target.value) } as HomeSection)} /></Field>
      <Field label="End (optional)" hint="Seasonal end. Empty = no expiry."><Input type="datetime-local" value={toDateTimeLocal(section.endsAt)} onChange={(e) => onChange({ ...section, endsAt: fromDateTimeLocal(e.target.value) } as HomeSection)} /></Field>
    </div>
  )
}

function SectionEditor({ section, categories, onChange, onDelete, onMove, onDuplicate }: { section: HomeSection; categories: Array<{ id: string; name: string }>; onChange: (section: HomeSection) => void; onDelete: () => void; onMove: (delta: number) => void; onDuplicate: () => void }) {
  return <div className="space-y-4"><div><p className="text-xs font-bold uppercase tracking-wider text-primary">{sectionLabels[section.type]}</p><h2 className="text-lg font-bold">Section settings</h2><p className="mt-1 text-xs text-muted-foreground">{sectionHints[section.type]}</p></div>
    {"title" in section ? <Field label="Title"><Input value={section.title ?? ""} onChange={(e) => onChange({ ...section, title: e.target.value } as HomeSection)} /></Field> : null}
    {"subtitle" in section ? <Field label="Subtitle (optional)" hint="One clarifying line under the title."><Input value={section.subtitle ?? ""} onChange={(e) => onChange({ ...section, subtitle: e.target.value || undefined } as HomeSection)} /></Field> : null}
    {section.type === "promo_hero" ? <>
      <Field label="Eyebrow (optional)"><Input value={section.eyebrow ?? ""} onChange={(e) => onChange({ ...section, eyebrow: e.target.value || undefined })} /></Field>
      <Field label="Supporting text"><Textarea value={section.body ?? ""} onChange={(e) => onChange({ ...section, body: e.target.value || undefined })} /></Field>
      <Field label="Layout"><select className="h-10 w-full rounded-lg border bg-white px-3" value={section.layout ?? "split"} onChange={(e) => onChange({ ...section, layout: e.target.value as "split" | "band" })}><option value="split">Split (image beside copy)</option><option value="band">Band (full-width backdrop)</option></select></Field>
      <Field label="Image URL" hint="HTTPS or internal path."><Input value={section.imageUrl ?? ""} onChange={(e) => onChange({ ...section, imageUrl: e.target.value || undefined })} /></Field>
      <Field label="Button label"><Input value={section.action?.label ?? ""} onChange={(e) => onChange({ ...section, action: { label: e.target.value, href: section.action?.href ?? "/" } })} /></Field>
      <Field label="Button link" hint="Internal path only, e.g. /categories/all"><Input value={section.action?.href ?? ""} onChange={(e) => onChange({ ...section, action: { label: section.action?.label ?? "Shop now", href: e.target.value } })} /></Field>
      <ThemeField value={section.theme} onChange={(theme) => onChange({ ...section, theme })} />
    </> : null}
    {section.type === "promo_grid" ? <>
      <ThemeField value={section.theme} onChange={(theme) => onChange({ ...section, theme })} />
      <Field label="Variant"><select className="h-10 w-full rounded-lg border bg-white px-3" value={section.variant ?? "cards"} onChange={(e) => onChange({ ...section, variant: e.target.value as "cards" | "bento" })}><option value="cards">Cards (even grid)</option><option value="bento">Bento (first tile featured)</option></select></Field>
      <Field label="Columns"><select className="h-10 w-full rounded-lg border bg-white px-3" value={section.columns} onChange={(e) => onChange({ ...section, columns: Number(e.target.value) as 2 | 3 | 4 })}><option>2</option><option>3</option><option>4</option></select></Field>
      <PromoTilesEditor section={section} onChange={onChange} />
    </> : null}
    {section.type === "category_grid" ? <>
      <Field label="Variant"><select className="h-10 w-full rounded-lg border bg-white px-3" value={section.variant ?? "tiles"} onChange={(e) => onChange({ ...section, variant: e.target.value as "tiles" | "mosaic" | "rail" })}><option value="tiles">Tiles (Walmart clarity)</option><option value="mosaic">Mosaic (bento feature)</option><option value="rail">Rail (compact scroll)</option></select></Field>
      <Field label="Columns"><select className="h-10 w-full rounded-lg border bg-white px-3" value={section.columns} onChange={(e) => onChange({ ...section, columns: Number(e.target.value) as 4 | 6 | 8 })}><option>4</option><option>6</option><option>8</option></select></Field>
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={section.showAllLink !== false} onChange={(e) => onChange({ ...section, showAllLink: e.target.checked })} /> Show “View all” link</label>
      <div><p className="mb-2 text-sm font-semibold">Categories ({section.categoryIds.length}/16)</p><div className="max-h-56 space-y-1 overflow-auto rounded-xl border p-2">{categories.length ? categories.map((category) => <label key={category.id} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-black/5"><input type="checkbox" checked={section.categoryIds.includes(category.id)} onChange={(event) => onChange({ ...section, categoryIds: event.target.checked ? [...section.categoryIds, category.id].slice(0, 16) : section.categoryIds.filter((id) => id !== category.id) })} /><span>{category.name}</span></label>) : <p className="p-2 text-xs text-muted-foreground">No categories available.</p>}</div></div>
    </> : null}
    {section.type === "product_shelf" ? <>
      <Field label="Product source" hint="Manual = explicit product IDs in order."><select className="h-10 w-full rounded-lg border bg-white px-3" value={section.source} onChange={(e) => onChange({ ...section, source: e.target.value as "featured" | "latest" | "category" | "manual" })}><option value="featured">Featured products</option><option value="latest">Latest products</option><option value="category">Category</option><option value="manual">Manual picks</option></select></Field>
      {section.source === "category" ? <Field label="Category"><select className="h-10 w-full rounded-lg border bg-white px-3" value={section.categoryId ?? ""} onChange={(e) => onChange({ ...section, categoryId: e.target.value || undefined })}><option value="">Select a category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field> : null}
      {section.source === "manual" ? <Field label="Product IDs" hint="One ID per line, in display order."><Textarea rows={3} value={(section.productIds ?? []).join("\n")} onChange={(e) => onChange({ ...section, productIds: e.target.value.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean).slice(0, 12) })} /></Field> : null}
      <Field label="Layout"><select className="h-10 w-full rounded-lg border bg-white px-3" value={section.layout ?? "grid"} onChange={(e) => onChange({ ...section, layout: e.target.value as "grid" | "carousel" })}><option value="grid">Grid (4 desktop / 2 mobile)</option><option value="carousel">Carousel (scroll rail)</option></select></Field>
      <Field label="Limit"><select className="h-10 w-full rounded-lg border bg-white px-3" value={section.limit} onChange={(e) => onChange({ ...section, limit: Number(e.target.value) as 4 | 8 | 12 })}><option>4</option><option>8</option><option>12</option></select></Field>
    </> : null}
    {section.type === "promo_band" ? <>
      <Field label="Eyebrow (optional)"><Input value={section.eyebrow ?? ""} onChange={(e) => onChange({ ...section, eyebrow: e.target.value || undefined })} /></Field>
      <Field label="Supporting text"><Textarea rows={2} value={section.body ?? ""} onChange={(e) => onChange({ ...section, body: e.target.value || undefined })} /></Field>
      <Field label="Image URL (optional backdrop)"><Input value={section.imageUrl ?? ""} onChange={(e) => onChange({ ...section, imageUrl: e.target.value || undefined })} /></Field>
      <Field label="Primary button label"><Input value={section.action?.label ?? ""} onChange={(e) => onChange({ ...section, action: { label: e.target.value, href: section.action?.href ?? "/" } })} /></Field>
      <Field label="Primary button link"><Input value={section.action?.href ?? ""} onChange={(e) => onChange({ ...section, action: { label: section.action?.label ?? "Shop now", href: e.target.value } })} /></Field>
      <Field label="Secondary button label (optional)"><Input value={section.secondaryAction?.label ?? ""} onChange={(e) => onChange({ ...section, secondaryAction: e.target.value ? { label: e.target.value, href: section.secondaryAction?.href ?? "/" } : undefined })} /></Field>
      <Field label="Secondary button link"><Input value={section.secondaryAction?.href ?? ""} onChange={(e) => onChange({ ...section, secondaryAction: section.secondaryAction ? { label: section.secondaryAction.label, href: e.target.value } : undefined })} /></Field>
      <ThemeField value={section.theme} onChange={(theme) => onChange({ ...section, theme })} />
    </> : null}
    {section.type === "value_grid" ? <ValueItemsEditor section={section} onChange={onChange} /> : null}
    <VisibilityFields section={section} onChange={onChange} />
    <div className="flex flex-wrap gap-2 border-t pt-4">
      <Button variant="outline" size="sm" onClick={() => onMove(-1)}>Move up</Button>
      <Button variant="outline" size="sm" onClick={() => onMove(1)}>Move down</Button>
      <Button variant="outline" size="sm" onClick={onDuplicate}><Copy className="mr-1 h-4 w-4" />Duplicate</Button>
      <Button variant="outline" size="sm" className="ml-auto text-destructive" onClick={onDelete}><Trash className="mr-1 h-4 w-4" />Delete</Button>
    </div>
  </div>
}

function PromoTilesEditor({ section, onChange }: { section: Extract<HomeSection, { type: "promo_grid" }>; onChange: (section: HomeSection) => void }) {
  const patchTile = (id: string, values: Partial<(typeof section.tiles)[number]>) => onChange({ ...section, tiles: section.tiles.map((tile) => tile.id === id ? { ...tile, ...values } : tile) })
  return <div className="space-y-3"><div className="flex items-center justify-between"><p className="text-sm font-semibold">Promo tiles ({section.tiles.length}/8)</p><Button type="button" variant="outline" size="sm" disabled={section.tiles.length >= 8} onClick={() => onChange({ ...section, tiles: [...section.tiles, { id: `${section.id}-${crypto.randomUUID().slice(0, 6)}`, title: "New promotion", href: "/categories/all" }] })}><Plus className="mr-1 h-3.5 w-3.5" />Add</Button></div>{section.tiles.map((tile, index) => <div key={tile.id} className="space-y-2 rounded-xl border bg-black/[0.02] p-3"><div className="flex items-center justify-between"><span className="text-xs font-bold text-muted-foreground">Tile {index + 1}{section.variant === "bento" && index === 0 ? " · featured" : ""}</span>{section.tiles.length > 1 ? <button type="button" aria-label={`Remove tile ${index + 1}`} onClick={() => onChange({ ...section, tiles: section.tiles.filter((item) => item.id !== tile.id) })}><Trash className="h-4 w-4" /></button> : null}</div><Input aria-label={`Tile ${index + 1} title`} placeholder="Title" value={tile.title} onChange={(e) => patchTile(tile.id, { title: e.target.value })} /><Input aria-label={`Tile ${index + 1} eyebrow`} placeholder="Eyebrow (optional)" value={tile.eyebrow ?? ""} onChange={(e) => patchTile(tile.id, { eyebrow: e.target.value || undefined })} /><Textarea aria-label={`Tile ${index + 1} text`} placeholder="Supporting text" rows={2} value={tile.body ?? ""} onChange={(e) => patchTile(tile.id, { body: e.target.value || undefined })} /><Input aria-label={`Tile ${index + 1} image`} placeholder="Image URL" value={tile.imageUrl ?? ""} onChange={(e) => patchTile(tile.id, { imageUrl: e.target.value || undefined })} /><Input aria-label={`Tile ${index + 1} link`} placeholder="Internal link, e.g. /categories/all" value={tile.href} onChange={(e) => patchTile(tile.id, { href: e.target.value })} /></div>)}</div>
}

function ValueItemsEditor({ section, onChange }: { section: Extract<HomeSection, { type: "value_grid" }>; onChange: (section: HomeSection) => void }) {
  const patchItem = (id: string, values: Partial<(typeof section.items)[number]>) => onChange({ ...section, items: section.items.map((item) => item.id === id ? { ...item, ...values } : item) })
  return <div className="space-y-3"><div className="flex items-center justify-between"><p className="text-sm font-semibold">Value cards</p><Button type="button" variant="outline" size="sm" disabled={section.items.length >= 4} onClick={() => onChange({ ...section, items: [...section.items, { id: `${section.id}-${crypto.randomUUID().slice(0, 6)}`, title: "New value", body: "Explain the customer benefit." }] })}><Plus className="mr-1 h-3.5 w-3.5" />Add</Button></div>{section.items.map((item, index) => <div key={item.id} className="space-y-2 rounded-xl border p-3"><Input aria-label={`Value ${index + 1} title`} value={item.title} onChange={(e) => patchItem(item.id, { title: e.target.value })} /><Textarea aria-label={`Value ${index + 1} body`} rows={2} value={item.body} onChange={(e) => patchItem(item.id, { body: e.target.value })} /></div>)}</div>
}

function StudioPreview({ sections, categoryNames }: { sections: HomeSection[]; categoryNames: Map<string, string> }) {
  if (!sections.length) return <div className="p-4"><MerchEmpty title="Empty homepage" body="Add sections from the library. The storefront falls back to the default category mosaic until managed content is published." /></div>
  return <div className="space-y-5 p-4">{sections.map((section) => {
    const dimmed = !isSectionVisible(section) ? "opacity-60" : ""
    if (section.type === "promo_hero") return <div key={section.id} className={dimmed}><MerchPromoHero {...section} layout={section.layout ?? "split"} interactive={false} compact /></div>
    if (section.type === "promo_grid") return <div key={section.id} className={dimmed}><MerchPromoGrid {...section} variant={section.variant ?? "cards"} interactive={false} compact /></div>
    if (section.type === "promo_band") return <div key={section.id} className={dimmed}><MerchPromoBand {...section} interactive={false} compact /></div>
    if (section.type === "category_grid") {
      const names = section.categoryIds.map((id) => categoryNames.get(id) ?? "Category").slice(0, section.columns)
      const placeholders = names.length ? names : Array.from({ length: Math.min(4, section.columns) }, (_, i) => `Category ${i + 1}`)
      return <div key={section.id} className={dimmed}><MerchGridSection title={section.title} subtitle={section.subtitle} columns={section.columns} variant={section.variant ?? "tiles"}>{placeholders.map((name, index) => <div key={index} className="aspect-square rounded-xl bg-[#f2f2f2] p-2 text-xs font-semibold">{name}</div>)}</MerchGridSection></div>
    }
    if (section.type === "product_shelf") return <div key={section.id} className={dimmed}><MerchShelf title={section.title} subtitle={section.subtitle} layout={section.layout ?? "grid"}><div className="grid grid-cols-4 gap-2">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="aspect-[3/4] rounded-xl border bg-white p-2"><div className="h-2/3 rounded-lg bg-[#f2f2f2]" /><div className="mt-2 h-2 rounded bg-black/10" /></div>)}</div></MerchShelf><p className="mt-1 text-[11px] text-muted-foreground">Source: {section.source}{section.source === "category" && !section.categoryId ? " · pick a category" : ""}{section.source === "manual" && !(section.productIds ?? []).length ? " · add product IDs" : ""}</p></div>
    return <div key={section.id} className={dimmed}><MerchValueGrid title={section.title} subtitle={section.subtitle} items={section.items} compact /></div>
  })}</div>
}
