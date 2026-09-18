import type { CategoryBannerTile, CategoryRatio, CategoryVariant, Daypart, HomeSection, HomeShelfSource } from "@alkemart/shared/homepage"
import { categoryRatioOf, categoryTilesOf, DAYPART_LABEL } from "@alkemart/shared/homepage"
import { CaretDown, CaretUp, Plus, Trash, WarningCircle } from "@phosphor-icons/react"
import { useEffect, useId, useState } from "react"
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  Checkbox,
  Input,
  Label,
  SchedulePicker,
  SelectItem,
  Separator,
  StudioImageField,
  StudioLinkField,
  StudioSelect,
  StudioTextField,
  StudioTextareaField,
  Switch,
  ThemeField,
  cn,
} from "@workspace/ui"
import { sectionAccents, sectionHints, sectionLabels } from "./model"

/**
 * A labelled settings cluster inside the inspector: title row with an
 * optional count and action, then the controls. Groups are what keep a
 * 10-control section scannable — tiles, categories, announcements and
 * cards each read as one block instead of a loose pile of inputs.
 */
function FieldGroup({ title, meta, action, hint, children }: {
  title: string
  meta?: string
  action?: React.ReactNode
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-3 rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">
          {title}
          {meta ? <span className="ml-1.5 font-normal tabular-nums text-muted-foreground">{meta}</span> : null}
        </h3>
        {action}
      </div>
      {hint ? <p className="-mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
      {children}
    </section>
  )
}

function VisibilityFields({ section, onChange }: { section: HomeSection; onChange: (section: HomeSection) => void }) {
  const switchId = useId()
  const startsInvalid = Boolean(section.startsAt && section.endsAt && section.startsAt >= section.endsAt)
  return (
    <details className="group rounded-2xl border border-dashed border-border">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-2xl px-4 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <span>
          Visibility &amp; scheduling
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {section.visible === false ? "Hidden" : section.startsAt || section.endsAt ? "Scheduled" : "Always on"}
          </span>
        </span>
        <CaretDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="flex flex-col gap-4 border-t border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor={switchId}>Visible on storefront</Label>
            <p className="text-xs text-muted-foreground">Hidden sections stay in your draft.</p>
          </div>
          <Switch
            id={switchId}
            checked={section.visible !== false}
            onCheckedChange={(checked) => onChange({ ...section, visible: checked } as HomeSection)}
          />
        </div>
        <Separator />
        <div className="flex flex-col gap-1.5">
          <Label id={`${switchId}-start`}>Start showing</Label>
          <SchedulePicker label="Start showing" labelledBy={`${switchId}-start`} value={section.startsAt ?? null} onChange={(startsAt) => onChange({ ...section, startsAt } as HomeSection)} />
          <p className="text-xs text-muted-foreground">Seasonal start. Empty means show immediately.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label id={`${switchId}-end`}>Stop showing</Label>
          <SchedulePicker label="Stop showing" labelledBy={`${switchId}-end`} value={section.endsAt ?? null} minDate={section.startsAt ? new Date(section.startsAt) : undefined} onChange={(endsAt) => onChange({ ...section, endsAt } as HomeSection)} />
          <p className="text-xs text-muted-foreground">Seasonal end. Empty means no expiry.</p>
        </div>
        {startsInvalid ? <p role="alert" className="text-xs font-semibold text-destructive">The stop date must be after the start date.</p> : null}
      </div>
    </details>
  )
}

const DAYPARTS: Daypart[] = ["breakfast", "lunch", "supper", "late"]

function ShelfSourceFields({ section, categories, onChange }: {
  section: Extract<HomeSection, { type: "product_shelf" | "deal_rail" }>
  categories: Array<{ id: string; name: string }>
  onChange: (section: HomeSection) => void
}) {
  const allowDaypart = section.type === "product_shelf"
  const source = section.source
  return (
    <>
      <StudioSelect
        label="Product source"
        groupLabel="Shelf source"
        hint="Rules fill themselves per buyer and hour. Manual means explicit product IDs in order."
        value={source}
        onValueChange={(next) => onChange({ ...section, source: next as HomeShelfSource })}
      >
        <SelectItem value="featured">Featured products</SelectItem>
        <SelectItem value="latest">Latest products</SelectItem>
        <SelectItem value="category">Category</SelectItem>
        <SelectItem value="manual">Manual picks</SelectItem>
        <SelectItem value="most_ordered">Most ordered</SelectItem>
        <SelectItem value="trending">Trending this week</SelectItem>
        {allowDaypart ? <SelectItem value="daypart">By time of day</SelectItem> : null}
        <SelectItem value="near_me">Near the buyer</SelectItem>
      </StudioSelect>
      {source === "category" ? (
        <StudioSelect label="Category" groupLabel="Shelf category" value={section.categoryId ?? ""} onValueChange={(next) => onChange({ ...section, categoryId: next || undefined })}>
          {categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
        </StudioSelect>
      ) : null}
      {source === "manual" ? (
        <StudioTextareaField
          label="Product IDs"
          hint="One ID per line, in display order."
          rows={3}
          value={(section.productIds ?? []).join("\n")}
          onChange={(e) => onChange({ ...section, productIds: e.target.value.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean).slice(0, 12) })}
        />
      ) : null}
      {allowDaypart && source === "daypart" ? (
        <FieldGroup title="Categories by time of day" hint="A daypart with no category stays empty rather than showing an unrelated shelf.">
          {DAYPARTS.map((part) => (
            <StudioSelect
              key={part}
              label={DAYPART_LABEL[part]}
              groupLabel={DAYPART_LABEL[part]}
              value={section.daypartCategoryIds?.[part] ?? "__none__"}
              onValueChange={(next) => onChange({
                ...section,
                daypartCategoryIds: { ...section.daypartCategoryIds, [part]: next === "__none__" ? undefined : next },
              })}
            >
              <SelectItem value="__none__">Not set</SelectItem>
              {categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
            </StudioSelect>
          ))}
        </FieldGroup>
      ) : null}
      {source === "near_me" ? (
        <p className="text-xs text-muted-foreground">Resolves to shops in each buyer’s saved delivery area. Preview it on the storefront.</p>
      ) : null}
    </>
  )
}

/**
 * Section settings.
 *
 * Reordering, duplicating and visibility deliberately live only in the section
 * list: having them in both places meant three interaction paths to the same
 * four operations. Delete stays here, next to the thing being deleted.
 */
export function SectionEditor({ section, categories, headingRef, issues, position, onChange, onDelete, onUpload }: {
  section: HomeSection
  categories: Array<{ id: string; name: string }>
  headingRef: React.RefObject<HTMLHeadingElement | null>
  issues: string[]
  /** "Section 2 of 5" — ties the inspector to the outline and canvas. */
  position: string
  onChange: (section: HomeSection) => void
  onDelete: () => void
  onUpload?: (file: File) => Promise<string>
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  useEffect(() => { setConfirmingDelete(false) }, [section.id])
  useEffect(() => {
    if (!confirmingDelete) return
    const timer = setTimeout(() => setConfirmingDelete(false), 5000)
    return () => clearTimeout(timer)
  }, [confirmingDelete])

  const accent = sectionAccents[section.type]
  const AccentIcon = accent.icon

  return (
    <Card className="overflow-hidden border-0 shadow-none">
      <div className="border-b border-border bg-white px-5 pb-4 pt-5">
        <div className="flex items-center gap-3">
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-2xl", accent.chip)} aria-hidden="true">
            <AccentIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              {sectionLabels[section.type]} · {position}
            </p>
            <h2 ref={headingRef} tabIndex={-1} className="truncate text-lg font-extrabold tracking-tight outline-none">
              {"title" in section && section.title ? section.title : sectionLabels[section.type]}
            </h2>
          </div>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{sectionHints[section.type]}</p>
        {issues.length ? (
          <div role="alert" className="mt-3 flex flex-col gap-1.5 rounded-2xl border border-tone-danger-ink/30 bg-tone-danger-soft p-3">
            <p className="flex items-center gap-1.5 text-sm font-bold text-tone-danger-ink">
              <WarningCircle className="h-4 w-4" aria-hidden="true" />
              Fix before publishing ({issues.length})
            </p>
            <ul className="flex list-disc flex-col gap-0.5 pl-5 text-sm text-tone-danger-ink">
              {issues.map((issue) => <li key={issue}>{issue}</li>)}
            </ul>
          </div>
        ) : null}
      </div>
      <CardContent className="flex flex-col gap-4 px-5 py-5">
        {"title" in section ? (
          <StudioTextField label="Title" value={section.title ?? ""} maxLength={100} onChange={(e) => onChange({ ...section, title: e.target.value } as HomeSection)} />
        ) : null}
        {"subtitle" in section ? (
          <StudioTextField label="Subtitle" value={section.subtitle ?? ""} maxLength={160} onChange={(e) => onChange({ ...section, subtitle: e.target.value || undefined } as HomeSection)} />
        ) : null}

        {section.type === "promo_hero" ? (
          <>
            <StudioTextField label="Eyebrow" value={section.eyebrow ?? ""} maxLength={40} onChange={(e) => onChange({ ...section, eyebrow: e.target.value || undefined })} />
            <StudioTextareaField label="Supporting text" value={section.body ?? ""} maxLength={240} onChange={(e) => onChange({ ...section, body: e.target.value || undefined })} />
            <StudioSelect label="Layout" groupLabel="Hero layout" value={section.layout ?? "split"} onValueChange={(next) => onChange({ ...section, layout: next as "split" | "band" })}>
              <SelectItem value="split">Split — image beside copy</SelectItem>
              <SelectItem value="band">Band — full-width backdrop</SelectItem>
            </StudioSelect>
            <StudioImageField label="Image" ratio={(section.layout ?? "split") === "band" ? "ultrawide" : "wide"} value={section.imageUrl ?? ""} onValueChange={(next) => onChange({ ...section, imageUrl: next || undefined })} onUpload={onUpload} />
            <StudioLinkField label="Button" optional value={section.action} onChange={(action) => onChange({ ...section, action })} />
            <ThemeField value={section.theme} onChange={(theme) => onChange({ ...section, theme })} />
          </>
        ) : null}

        {section.type === "promo_grid" ? (
          <>
            <ThemeField value={section.theme} onChange={(theme) => onChange({ ...section, theme })} />
            <StudioSelect label="Variant" groupLabel="Grid variant" value={section.variant ?? "cards"} onValueChange={(next) => onChange({ ...section, variant: next as "cards" | "bento" })}>
              <SelectItem value="cards">Cards — even grid</SelectItem>
              <SelectItem value="bento">Bento — first tile featured</SelectItem>
            </StudioSelect>
            <StudioSelect label="Columns" groupLabel="Desktop columns" value={String(section.columns)} onValueChange={(next) => onChange({ ...section, columns: Number(next) as 2 | 3 | 4 })}>
              <SelectItem value="2">2 columns</SelectItem>
              <SelectItem value="3">3 columns</SelectItem>
              <SelectItem value="4">4 columns</SelectItem>
            </StudioSelect>
            <PromoTilesEditor section={section} onChange={onChange} onUpload={onUpload} />
          </>
        ) : null}

        {section.type === "category_grid" ? (
          <>
            <StudioSelect label="Layout" groupLabel="Category layout" value={section.variant ?? "tiles"} onValueChange={(next) => onChange({ ...section, variant: next as CategoryVariant })}>
              <SelectItem value="mosaic">Mosaic — two large, two small</SelectItem>
              <SelectItem value="tiles">Tiles — even grid</SelectItem>
              <SelectItem value="banner">Banner — wide strips</SelectItem>
              <SelectItem value="rail">Rail — compact scroll</SelectItem>
            </StudioSelect>
            <StudioSelect label="Banner shape" groupLabel="Banner proportions" hint="Art is cropped to this ratio, never stretched to a fixed height." value={section.ratio ?? categoryRatioOf(section)} onValueChange={(next) => onChange({ ...section, ratio: next as CategoryRatio })}>
              <SelectItem value="square">Square — 1:1</SelectItem>
              <SelectItem value="landscape">Landscape — 4:3</SelectItem>
              <SelectItem value="wide">Wide — 3:2</SelectItem>
              <SelectItem value="ultrawide">Ultra-wide — 16:5 strip</SelectItem>
            </StudioSelect>
            {(section.variant ?? "tiles") !== "mosaic" ? (
              <StudioSelect label="Columns" groupLabel="Desktop columns" value={String(section.columns)} onValueChange={(next) => onChange({ ...section, columns: Number(next) as 4 | 6 | 8 })}>
                <SelectItem value="4">4 columns</SelectItem>
                <SelectItem value="6">6 columns</SelectItem>
                <SelectItem value="8">8 columns</SelectItem>
              </StudioSelect>
            ) : null}
            <div className="flex items-center gap-2">
              <Checkbox
                id={`show-all-${section.id}`}
                checked={section.showAllLink !== false}
                onCheckedChange={(checked) => onChange({ ...section, showAllLink: checked === true })}
              />
              <Label htmlFor={`show-all-${section.id}`}>Show “View all” link</Label>
            </div>
            <CategoryTilesEditor section={section} categories={categories} onChange={onChange} onUpload={onUpload} />
          </>
        ) : null}

        {section.type === "product_shelf" ? (
          <>
            <ShelfSourceFields section={section} categories={categories} onChange={onChange} />
            <StudioSelect label="Layout" groupLabel="Shelf layout" value={section.layout ?? "grid"} onValueChange={(next) => onChange({ ...section, layout: next as "grid" | "carousel" })}>
              <SelectItem value="grid">Grid — 4 desktop / 2 mobile</SelectItem>
              <SelectItem value="carousel">Carousel — scroll rail</SelectItem>
            </StudioSelect>
            <StudioSelect label="Limit" groupLabel="Product limit" value={String(section.limit)} onValueChange={(next) => onChange({ ...section, limit: Number(next) as 4 | 8 | 12 })}>
              <SelectItem value="4">4 products</SelectItem>
              <SelectItem value="8">8 products</SelectItem>
              <SelectItem value="12">12 products</SelectItem>
            </StudioSelect>
          </>
        ) : null}

        {section.type === "promo_band" ? (
          <>
            <StudioTextField label="Eyebrow" value={section.eyebrow ?? ""} maxLength={40} onChange={(e) => onChange({ ...section, eyebrow: e.target.value || undefined })} />
            <StudioTextareaField label="Supporting text" rows={2} value={section.body ?? ""} maxLength={240} onChange={(e) => onChange({ ...section, body: e.target.value || undefined })} />
            <StudioImageField label="Backdrop image" ratio="ultrawide" hint="Sits behind the copy at low opacity. Keep it uncluttered." value={section.imageUrl ?? ""} onValueChange={(next) => onChange({ ...section, imageUrl: next || undefined })} onUpload={onUpload} />
            <StudioLinkField label="Primary button" optional value={section.action} onChange={(action) => onChange({ ...section, action })} />
            <StudioLinkField label="Secondary button" optional value={section.secondaryAction} onChange={(secondaryAction) => onChange({ ...section, secondaryAction })} />
            <ThemeField value={section.theme} onChange={(theme) => onChange({ ...section, theme })} />
          </>
        ) : null}

        {section.type === "countdown_banner" ? (
          <>
            <StudioTextField label="Eyebrow" value={section.eyebrow ?? ""} maxLength={40} onChange={(e) => onChange({ ...section, eyebrow: e.target.value || undefined })} />
            <StudioTextareaField label="Supporting text" rows={2} value={section.body ?? ""} maxLength={240} onChange={(e) => onChange({ ...section, body: e.target.value || undefined })} />
            <div className="flex flex-col gap-1.5">
              <Label id={`countdown-${section.id}`}>Counts down to</Label>
              <SchedulePicker label="Counts down to" labelledBy={`countdown-${section.id}`} value={section.countdownTo} minDate={new Date()} onChange={(next) => onChange({ ...section, countdownTo: next ?? section.countdownTo })} />
              <p className="text-xs text-muted-foreground">
                The clock stops at zero and shows the ended message. To remove the whole section at that moment, set the same time as “Stop showing” below.
              </p>
            </div>
            <StudioTextField label="Message when it ends" value={section.expiredLabel ?? ""} maxLength={60} placeholder="Offer ended" onChange={(e) => onChange({ ...section, expiredLabel: e.target.value || undefined })} />
            <StudioImageField label="Backdrop image" ratio="ultrawide" hint="Sits behind the copy at low opacity." value={section.imageUrl ?? ""} onValueChange={(next) => onChange({ ...section, imageUrl: next || undefined })} onUpload={onUpload} />
            <StudioLinkField label="Button" optional value={section.action} onChange={(action) => onChange({ ...section, action })} />
            <ThemeField value={section.theme} onChange={(theme) => onChange({ ...section, theme })} />
          </>
        ) : null}

        {section.type === "marquee" ? (
          <>
            <ThemeField value={section.theme} onChange={(theme) => onChange({ ...section, theme })} />
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor={`marquee-motion-${section.id}`}>Scroll the strip</Label>
                <p className="text-xs text-muted-foreground">Buyers get a pause button, and reduced-motion settings stop it automatically.</p>
              </div>
              <Switch
                id={`marquee-motion-${section.id}`}
                checked={section.animated !== false}
                onCheckedChange={(checked) => onChange({ ...section, animated: checked })}
              />
            </div>
            {section.animated !== false ? (
              <StudioSelect label="Speed" groupLabel="Scroll speed" value={section.speed ?? "normal"} onValueChange={(next) => onChange({ ...section, speed: next as "slow" | "normal" })}>
                <SelectItem value="slow">Slow — easier to read</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
              </StudioSelect>
            ) : null}
            <MarqueeItemsEditor section={section} onChange={onChange} />
          </>
        ) : null}

        {section.type === "deal_rail" ? (
          <>
            <StudioTextField label="Eyebrow" value={section.eyebrow ?? ""} maxLength={40} onChange={(e) => onChange({ ...section, eyebrow: e.target.value || undefined })} />
            <StudioTextField label="Card badge" hint="Stamped on every card, e.g. Deal or Ends today." value={section.badge ?? ""} maxLength={20} onChange={(e) => onChange({ ...section, badge: e.target.value || undefined })} />
            <ShelfSourceFields section={section} categories={categories} onChange={onChange} />
            <StudioSelect label="Limit" groupLabel="Product limit" value={String(section.limit)} onValueChange={(next) => onChange({ ...section, limit: Number(next) as 4 | 8 | 12 })}>
              <SelectItem value="4">4 products</SelectItem>
              <SelectItem value="8">8 products</SelectItem>
              <SelectItem value="12">12 products</SelectItem>
            </StudioSelect>
            <div className="flex flex-col gap-1.5">
              <Label id={`deal-clock-${section.id}`}>Clock in the header</Label>
              <SchedulePicker label="Clock in the header" labelledBy={`deal-clock-${section.id}`} value={section.countdownTo ?? null} minDate={new Date()} onChange={(countdownTo) => onChange({ ...section, countdownTo: countdownTo ?? undefined })} />
              <p className="text-xs text-muted-foreground">Optional. Leave empty for a rail with no deadline.</p>
            </div>
          </>
        ) : null}

        {section.type === "store_rail" ? (
          <>
            <StudioSelect
              label="Shop source"
              groupLabel="Rail source"
              hint="A marketplace merchandises its vendors with rules, not just product picks."
              value={section.source}
              onValueChange={(next) => onChange({ ...section, source: next as Extract<HomeSection, { type: "store_rail" }>["source"] })}
            >
              <SelectItem value="top_rated">Top rated</SelectItem>
              <SelectItem value="fastest">Fastest delivery</SelectItem>
              <SelectItem value="newest">Newest shops</SelectItem>
              <SelectItem value="near_me">Near the buyer</SelectItem>
              <SelectItem value="manual">Manual picks</SelectItem>
            </StudioSelect>
            {section.source === "manual" ? (
              <StudioTextareaField
                label="Shop handles"
                hint="One handle per line, in display order."
                rows={3}
                value={(section.sellerHandles ?? []).join("\n")}
                onChange={(e) => onChange({ ...section, sellerHandles: e.target.value.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean).slice(0, 12) })}
              />
            ) : null}
            {section.source === "near_me" ? (
              <p className="text-xs text-muted-foreground">Resolves to shops in each buyer’s saved delivery area. Preview it on the storefront.</p>
            ) : null}
            <StudioSelect label="Layout" groupLabel="Rail layout" value={section.layout ?? "grid"} onValueChange={(next) => onChange({ ...section, layout: next as "grid" | "carousel" })}>
              <SelectItem value="grid">Grid — 4 desktop / 2 mobile</SelectItem>
              <SelectItem value="carousel">Carousel — scroll rail</SelectItem>
            </StudioSelect>
            <StudioSelect label="Limit" groupLabel="Shop limit" value={String(section.limit)} onValueChange={(next) => onChange({ ...section, limit: Number(next) as 4 | 8 | 12 })}>
              <SelectItem value="4">4 shops</SelectItem>
              <SelectItem value="8">8 shops</SelectItem>
              <SelectItem value="12">12 shops</SelectItem>
            </StudioSelect>
          </>
        ) : null}

        {section.type === "value_grid" ? <ValueItemsEditor section={section} onChange={onChange} /> : null}

        <VisibilityFields section={section} onChange={onChange} />
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-2">
        <Separator />
        {confirmingDelete ? (
          <div className="flex flex-col gap-2 rounded-2xl border border-tone-danger-ink/30 bg-tone-danger-soft p-3" role="alert">
            <p className="text-sm font-bold text-tone-danger-ink">Delete this section?</p>
            <div className="flex gap-2">
              <Button variant="destructive" size="sm" className="flex-1" onClick={onDelete}>Confirm</Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setConfirmingDelete(false)}>Keep</Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="text-tone-danger-ink hover:text-tone-danger-ink" onClick={() => setConfirmingDelete(true)}>
            <Trash className="mr-1 h-4 w-4" aria-hidden="true" />
            Delete section
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

/**
 * Category banner tiles. Selecting a category creates a tile; each tile then
 * carries its own art, crop and copy, so the same category can be merchandised
 * differently in different placements.
 */
function CategoryTilesEditor({ section, categories, onChange, onUpload }: {
  section: Extract<HomeSection, { type: "category_grid" }>
  categories: Array<{ id: string; name: string }>
  onChange: (section: HomeSection) => void
  onUpload?: (file: File) => Promise<string>
}) {
  const tiles = categoryTilesOf(section)
  const setTiles = (next: CategoryBannerTile[]) => onChange({ ...section, tiles: next, categoryIds: undefined } as HomeSection)
  const patch = (categoryId: string, values: Partial<CategoryBannerTile>) =>
    setTiles(tiles.map((tile) => (tile.categoryId === categoryId ? { ...tile, ...values } : tile)))
  const toggle = (categoryId: string, checked: boolean) => {
    if (!checked) return setTiles(tiles.filter((tile) => tile.categoryId !== categoryId))
    if (tiles.length >= 16 || tiles.some((tile) => tile.categoryId === categoryId)) return
    setTiles([...tiles, { categoryId, slot: tiles.length < 2 ? "feature" : "standard" }])
  }
  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta
    if (target < 0 || target >= tiles.length) return
    const next = [...tiles]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    setTiles(next)
  }
  const nameOf = (categoryId: string) => categories.find((category) => category.id === categoryId)?.name ?? "Category"
  const mosaic = (section.variant ?? "tiles") === "mosaic"
  const ratio = categoryRatioOf(section)
  const [filter, setFilter] = useState("")
  const visibleCategories = categories.filter((category) =>
    category.name.toLowerCase().includes(filter.trim().toLowerCase()),
  )

  return (
    <div className="flex flex-col gap-3">
      <FieldGroup
        title="Categories"
        meta={`${tiles.length}/16`}
        hint={mosaic && tiles.length > 4 ? "Mosaic shows the first 4 tiles." : undefined}
      >
        {tiles.length ? (
          <p className="text-xs text-muted-foreground">
            {tiles.map((tile) => nameOf(tile.categoryId)).join(" · ")}
          </p>
        ) : (
          <p className="rounded-xl bg-tone-warning-soft px-2.5 py-2 text-xs font-semibold text-tone-warning-ink">
            No categories picked yet — tick at least one, or this section blocks saving.
          </p>
        )}
        <Input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter categories…"
          aria-label="Filter categories"
          className="h-8"
        />
        <div className="flex max-h-48 flex-col gap-0.5 overflow-auto pr-1" role="group" aria-label="Category picker">
          {visibleCategories.length ? visibleCategories.map((category) => (
            <div key={category.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-tone-neutral-soft">
              <Checkbox
                id={`cat-${section.id}-${category.id}`}
                checked={tiles.some((tile) => tile.categoryId === category.id)}
                onCheckedChange={(isChecked) => toggle(category.id, isChecked === true)}
              />
              <Label htmlFor={`cat-${section.id}-${category.id}`} className="flex-1 cursor-pointer text-sm font-normal">{category.name}</Label>
            </div>
          )) : <p className="p-2 text-xs text-muted-foreground">{categories.length ? "No categories match." : "No categories available."}</p>}
        </div>
      </FieldGroup>

      {tiles.map((tile, index) => (
        <details key={tile.categoryId} className="group rounded-2xl border border-border">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            <span className="truncate">
              {index + 1}. {tile.label || nameOf(tile.categoryId)}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {tile.slot === "feature" ? "Feature" : "Standard"}{tile.imageUrl ? " · custom art" : " · default art"}
              </span>
            </span>
            <CaretDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="flex flex-col gap-3 border-t border-border p-3">
            <StudioSelect label="Size" groupLabel="Tile size" hint="Feature tiles take the large cells." value={tile.slot ?? "standard"} onValueChange={(next) => patch(tile.categoryId, { slot: next as CategoryBannerTile["slot"] })}>
              <SelectItem value="feature">Feature — large</SelectItem>
              <SelectItem value="standard">Standard</SelectItem>
            </StudioSelect>
            <StudioImageField
              label="Banner image"
              hint="Empty uses the category's default photo."
              ratio={ratio}
              value={tile.imageUrl ?? ""}
              onValueChange={(next) => patch(tile.categoryId, { imageUrl: next || undefined })}
              focalPoint={tile.focalPoint}
              onFocalPointChange={(focalPoint) => patch(tile.categoryId, { focalPoint })}
              onUpload={onUpload}
            />
            <StudioTextField label="Label" hint="Empty uses the catalogue category name." value={tile.label ?? ""} maxLength={60} onChange={(e) => patch(tile.categoryId, { label: e.target.value || undefined })} />
            <StudioTextField label="Eyebrow" hint="Small line above the label, e.g. Up to 40% off." value={tile.eyebrow ?? ""} maxLength={40} onChange={(e) => patch(tile.categoryId, { eyebrow: e.target.value || undefined })} />
            <StudioTextField label="Badge" hint="Corner flag, e.g. New or Flash." value={tile.badge ?? ""} maxLength={20} onChange={(e) => patch(tile.categoryId, { badge: e.target.value || undefined })} />
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="flex-1" disabled={index === 0} aria-label={`Move ${nameOf(tile.categoryId)} earlier`} onClick={() => move(index, -1)}>
                <CaretUp className="mr-1 h-4 w-4" aria-hidden="true" />
                Earlier
              </Button>
              <Button type="button" variant="outline" size="sm" className="flex-1" disabled={index === tiles.length - 1} aria-label={`Move ${nameOf(tile.categoryId)} later`} onClick={() => move(index, 1)}>
                <CaretDown className="mr-1 h-4 w-4" aria-hidden="true" />
                Later
              </Button>
              <Button type="button" variant="ghost" size="sm" aria-label={`Remove ${nameOf(tile.categoryId)}`} onClick={() => toggle(tile.categoryId, false)}>
                <Trash className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </details>
      ))}
    </div>
  )
}

function PromoTilesEditor({ section, onChange, onUpload }: { section: Extract<HomeSection, { type: "promo_grid" }>; onChange: (section: HomeSection) => void; onUpload?: (file: File) => Promise<string> }) {
  const patchTile = (id: string, values: Partial<(typeof section.tiles)[number]>) => onChange({ ...section, tiles: section.tiles.map((tile) => tile.id === id ? { ...tile, ...values } : tile) })
  return (
    <FieldGroup
      title="Tiles"
      meta={`${section.tiles.length}/8`}
      action={(
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-xs"
          disabled={section.tiles.length >= 8}
          onClick={() => onChange({ ...section, tiles: [...section.tiles, { id: `${section.id}-${crypto.randomUUID().slice(0, 6)}`, title: "New promotion", href: "/categories/all" }] })}
        >
          <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          Add
        </Button>
      )}
    >
      {section.tiles.length <= 1 ? (
        <p className="text-xs text-muted-foreground">The last tile can't be removed — delete the section instead.</p>
      ) : null}
      {section.tiles.map((tile, index) => (
        <div key={tile.id} className="flex flex-col gap-3 rounded-xl border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-muted-foreground">Tile {index + 1}{section.variant === "bento" && index === 0 ? " · featured" : ""}</span>
            {section.tiles.length > 1 ? (
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove tile ${index + 1}: ${tile.title}`} onClick={() => onChange({ ...section, tiles: section.tiles.filter((item) => item.id !== tile.id) })}>
                <Trash className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : null}
          </div>
          <StudioTextField label="Title" value={tile.title} maxLength={80} onChange={(e) => patchTile(tile.id, { title: e.target.value })} />
          <StudioTextField label="Eyebrow" value={tile.eyebrow ?? ""} maxLength={40} onChange={(e) => patchTile(tile.id, { eyebrow: e.target.value || undefined })} />
          <StudioTextareaField label="Text" rows={2} value={tile.body ?? ""} maxLength={240} onChange={(e) => patchTile(tile.id, { body: e.target.value || undefined })} />
          <StudioImageField label="Image" ratio={section.variant === "bento" && index === 0 ? "wide" : "landscape"} value={tile.imageUrl ?? ""} onValueChange={(next) => patchTile(tile.id, { imageUrl: next || undefined })} onUpload={onUpload} />
          <StudioTextField label="Link" hint="Internal path, e.g. /categories/all" value={tile.href} onChange={(e) => patchTile(tile.id, { href: e.target.value })} />
        </div>
      ))}
    </FieldGroup>
  )
}

function MarqueeItemsEditor({ section, onChange }: { section: Extract<HomeSection, { type: "marquee" }>; onChange: (section: HomeSection) => void }) {
  const patchItem = (id: string, values: Partial<(typeof section.items)[number]>) =>
    onChange({ ...section, items: section.items.map((item) => (item.id === id ? { ...item, ...values } : item)) })
  return (
    <FieldGroup
      title="Announcements"
      meta={`${section.items.length}/8`}
      action={(
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-xs"
          disabled={section.items.length >= 8}
          onClick={() => onChange({ ...section, items: [...section.items, { id: `${section.id}-${crypto.randomUUID().slice(0, 6)}`, label: "New announcement" }] })}
        >
          <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          Add
        </Button>
      )}
    >
      {section.items.length <= 1 ? (
        <p className="text-xs text-muted-foreground">The last announcement can't be removed — delete the section instead.</p>
      ) : null}
      {section.items.map((item, index) => (
        <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-muted-foreground">Item {index + 1}</span>
            {section.items.length > 1 ? (
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove item ${index + 1}: ${item.label}`} onClick={() => onChange({ ...section, items: section.items.filter((entry) => entry.id !== item.id) })}>
                <Trash className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : null}
          </div>
          <StudioTextField label="Text" value={item.label} maxLength={80} onChange={(e) => patchItem(item.id, { label: e.target.value })} />
          <StudioTextField label="Link" hint="Optional internal path, e.g. /sell" value={item.href ?? ""} onChange={(e) => patchItem(item.id, { href: e.target.value || undefined })} />
        </div>
      ))}
    </FieldGroup>
  )
}

function ValueItemsEditor({ section, onChange }: { section: Extract<HomeSection, { type: "value_grid" }>; onChange: (section: HomeSection) => void }) {
  const patchItem = (id: string, values: Partial<(typeof section.items)[number]>) => onChange({ ...section, items: section.items.map((item) => item.id === id ? { ...item, ...values } : item) })
  const atMinimum = section.items.length <= 2
  return (
    <FieldGroup
      title="Cards"
      meta={`${section.items.length}/4`}
      action={(
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-xs"
          disabled={section.items.length >= 4}
          onClick={() => onChange({ ...section, items: [...section.items, { id: `${section.id}-${crypto.randomUUID().slice(0, 6)}`, title: "New value", body: "Explain the customer benefit." }] })}
        >
          <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          Add
        </Button>
      )}
    >
      {section.items.map((item, index) => (
        <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-muted-foreground">Card {index + 1}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={atMinimum}
              title={atMinimum ? "Value grids need at least 2 cards — delete the section instead" : `Remove card ${index + 1}: ${item.title}`}
              aria-label={atMinimum ? `Cannot remove card ${index + 1}: value grids need at least 2 cards` : `Remove card ${index + 1}: ${item.title}`}
              onClick={() => onChange({ ...section, items: section.items.filter((entry) => entry.id !== item.id) })}
            >
              <Trash className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <StudioTextField label={`Card ${index + 1} title`} value={item.title} maxLength={80} onChange={(e) => patchItem(item.id, { title: e.target.value })} />
          <StudioTextareaField label="Description" rows={2} value={item.body} maxLength={180} onChange={(e) => patchItem(item.id, { body: e.target.value })} />
        </div>
      ))}
      {atMinimum ? (
        <p className="text-xs text-muted-foreground">Value grids need at least 2 cards — delete the section instead of removing more.</p>
      ) : null}
    </FieldGroup>
  )
}
