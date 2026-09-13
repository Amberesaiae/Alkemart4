import type { HomeSection } from "@alkemart/shared/homepage"
import { CaretDown, CaretUp, Copy, Plus, Trash } from "@phosphor-icons/react"
import { useEffect, useId, useState } from "react"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  Checkbox,
  Label,
  SchedulePicker,
  SelectItem,
  Separator,
  StudioSelect,
  StudioTextField,
  StudioTextareaField,
  Switch,
  ThemeField,
  cn,
} from "@workspace/ui"
import { sectionAccents, sectionHints, sectionLabels } from "./model"

function VisibilityFields({ section, onChange }: { section: HomeSection; onChange: (section: HomeSection) => void }) {
  const switchId = useId()
  const startsInvalid = Boolean(section.startsAt && section.endsAt && section.startsAt >= section.endsAt)
  return (
    <details className="group rounded-xl border border-dashed border-border">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
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

export function SectionEditor({ section, position, total, categories, headingRef, onChange, onDelete, onMove, onDuplicate }: {
  section: HomeSection
  position: number
  total: number
  categories: Array<{ id: string; name: string }>
  headingRef: React.RefObject<HTMLHeadingElement | null>
  onChange: (section: HomeSection) => void
  onDelete: () => void
  onMove: (delta: -1 | 1) => void
  onDuplicate: () => void
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
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className={cn("flex size-8 items-center justify-center rounded-lg", accent.chip)} aria-hidden="true">
            <AccentIcon className="h-4 w-4" />
          </span>
          <Badge variant="outline">{sectionLabels[section.type]} · {position} of {total}</Badge>
        </div>
        <h2 ref={headingRef} tabIndex={-1} className="font-semibold leading-none tracking-tight outline-none">
          {"title" in section && section.title ? section.title : sectionLabels[section.type]}
        </h2>
        <CardDescription>{sectionHints[section.type]}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {"title" in section ? (
          <StudioTextField label="Title" value={section.title ?? ""} maxLength={100} onChange={(e) => onChange({ ...section, title: e.target.value } as HomeSection)} />
        ) : null}
        {"subtitle" in section ? (
          <StudioTextField label="Subtitle" hint="One clarifying line under the title." value={section.subtitle ?? ""} maxLength={160} onChange={(e) => onChange({ ...section, subtitle: e.target.value || undefined } as HomeSection)} />
        ) : null}

        {section.type === "promo_hero" ? (
          <>
            <StudioTextField label="Eyebrow" value={section.eyebrow ?? ""} maxLength={40} onChange={(e) => onChange({ ...section, eyebrow: e.target.value || undefined })} />
            <StudioTextareaField label="Supporting text" value={section.body ?? ""} maxLength={240} onChange={(e) => onChange({ ...section, body: e.target.value || undefined })} />
            <StudioSelect label="Layout" groupLabel="Hero layout" value={section.layout ?? "split"} onValueChange={(next) => onChange({ ...section, layout: next as "split" | "band" })}>
              <SelectItem value="split">Split — image beside copy</SelectItem>
              <SelectItem value="band">Band — full-width backdrop</SelectItem>
            </StudioSelect>
            <StudioTextField label="Image URL" hint="HTTPS or internal path." value={section.imageUrl ?? ""} inputMode="url" onChange={(e) => onChange({ ...section, imageUrl: e.target.value || undefined })} />
            <StudioTextField label="Button label" value={section.action?.label ?? ""} maxLength={40} onChange={(e) => onChange({ ...section, action: { label: e.target.value, href: section.action?.href ?? "/" } })} />
            <StudioTextField label="Button link" hint="Internal path, e.g. /categories/all" value={section.action?.href ?? ""} inputMode="url" onChange={(e) => onChange({ ...section, action: { label: section.action?.label ?? "Shop now", href: e.target.value } })} />
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
            <PromoTilesEditor section={section} onChange={onChange} />
          </>
        ) : null}

        {section.type === "category_grid" ? (
          <>
            <StudioSelect label="Variant" groupLabel="Category layout" value={section.variant ?? "tiles"} onValueChange={(next) => onChange({ ...section, variant: next as "tiles" | "mosaic" | "rail" })}>
              <SelectItem value="tiles">Tiles — Walmart clarity</SelectItem>
              <SelectItem value="mosaic">Mosaic — bento feature</SelectItem>
              <SelectItem value="rail">Rail — compact scroll</SelectItem>
            </StudioSelect>
            <StudioSelect label="Columns" groupLabel="Desktop columns" value={String(section.columns)} onValueChange={(next) => onChange({ ...section, columns: Number(next) as 4 | 6 | 8 })}>
              <SelectItem value="4">4 columns</SelectItem>
              <SelectItem value="6">6 columns</SelectItem>
              <SelectItem value="8">8 columns</SelectItem>
            </StudioSelect>
            <div className="flex items-center gap-2">
              <Checkbox
                id={`show-all-${section.id}`}
                checked={section.showAllLink !== false}
                onCheckedChange={(checked) => onChange({ ...section, showAllLink: checked === true })}
              />
              <Label htmlFor={`show-all-${section.id}`}>Show “View all” link</Label>
            </div>
            <fieldset className="flex flex-col gap-2 rounded-xl border border-border p-3">
              <legend className="px-1 text-sm font-semibold">Categories ({section.categoryIds.length}/16)</legend>
              <div className="flex max-h-56 flex-col gap-0.5 overflow-auto pr-1">
                {categories.length ? categories.map((category) => (
                  <div key={category.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted">
                    <Checkbox
                      id={`cat-${section.id}-${category.id}`}
                      checked={section.categoryIds.includes(category.id)}
                      onCheckedChange={(isChecked) => onChange({
                        ...section,
                        categoryIds: isChecked === true
                          ? [...section.categoryIds, category.id].slice(0, 16)
                          : section.categoryIds.filter((id) => id !== category.id),
                      })}
                    />
                    <Label htmlFor={`cat-${section.id}-${category.id}`} className="flex-1 cursor-pointer text-sm font-normal">{category.name}</Label>
                  </div>
                )) : <p className="p-2 text-xs text-muted-foreground">No categories available.</p>}
              </div>
            </fieldset>
          </>
        ) : null}

        {section.type === "product_shelf" ? (
          <>
            <StudioSelect label="Product source" groupLabel="Shelf source" hint="Manual means explicit product IDs in order." value={section.source} onValueChange={(next) => onChange({ ...section, source: next as "featured" | "latest" | "category" | "manual" })}>
              <SelectItem value="featured">Featured products</SelectItem>
              <SelectItem value="latest">Latest products</SelectItem>
              <SelectItem value="category">Category</SelectItem>
              <SelectItem value="manual">Manual picks</SelectItem>
            </StudioSelect>
            {section.source === "category" ? (
              <StudioSelect label="Category" groupLabel="Shelf category" value={section.categoryId ?? ""} onValueChange={(next) => onChange({ ...section, categoryId: next || undefined })}>
                {categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
              </StudioSelect>
            ) : null}
            {section.source === "manual" ? (
              <StudioTextareaField label="Product IDs" hint="One ID per line, in display order." rows={3} value={(section.productIds ?? []).join("\n")} onChange={(e) => onChange({ ...section, productIds: e.target.value.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean).slice(0, 12) })} />
            ) : null}
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
            <StudioTextField label="Backdrop image URL" value={section.imageUrl ?? ""} inputMode="url" onChange={(e) => onChange({ ...section, imageUrl: e.target.value || undefined })} />
            <StudioTextField label="Primary button label" value={section.action?.label ?? ""} maxLength={40} onChange={(e) => onChange({ ...section, action: { label: e.target.value, href: section.action?.href ?? "/" } })} />
            <StudioTextField label="Primary button link" value={section.action?.href ?? ""} inputMode="url" onChange={(e) => onChange({ ...section, action: { label: section.action?.label ?? "Shop now", href: e.target.value } })} />
            <StudioTextField label="Secondary button label" value={section.secondaryAction?.label ?? ""} maxLength={40} onChange={(e) => onChange({ ...section, secondaryAction: e.target.value ? { label: e.target.value, href: section.secondaryAction?.href ?? "/" } : undefined })} />
            <StudioTextField label="Secondary button link" value={section.secondaryAction?.href ?? ""} inputMode="url" onChange={(e) => onChange({ ...section, secondaryAction: section.secondaryAction ? { label: section.secondaryAction.label, href: e.target.value } : undefined })} />
            <ThemeField value={section.theme} onChange={(theme) => onChange({ ...section, theme })} />
          </>
        ) : null}

        {section.type === "value_grid" ? <ValueItemsEditor section={section} onChange={onChange} /> : null}

        <VisibilityFields section={section} onChange={onChange} />
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-2">
        <Separator />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" disabled={position <= 1} aria-label="Move section up" onClick={() => onMove(-1)}>
            <CaretUp className="mr-1 h-4 w-4" aria-hidden="true" />
            Up
          </Button>
          <Button variant="outline" size="sm" className="flex-1" disabled={position >= total} aria-label="Move section down" onClick={() => onMove(1)}>
            <CaretDown className="mr-1 h-4 w-4" aria-hidden="true" />
            Down
          </Button>
          <Button variant="outline" size="sm" className="flex-1" aria-label="Copy section" onClick={onDuplicate}>
            <Copy className="mr-1 h-4 w-4" aria-hidden="true" />
            Copy
          </Button>
        </div>
        {confirmingDelete ? (
          <div className="flex flex-col gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3" role="alert">
            <p className="text-sm font-semibold">Delete this section?</p>
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

function PromoTilesEditor({ section, onChange }: { section: Extract<HomeSection, { type: "promo_grid" }>; onChange: (section: HomeSection) => void }) {
  const patchTile = (id: string, values: Partial<(typeof section.tiles)[number]>) => onChange({ ...section, tiles: section.tiles.map((tile) => tile.id === id ? { ...tile, ...values } : tile) })
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p id={`tiles-${section.id}`} className="text-sm font-semibold">Tiles ({section.tiles.length}/8)</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={section.tiles.length >= 8}
          onClick={() => onChange({ ...section, tiles: [...section.tiles, { id: `${section.id}-${crypto.randomUUID().slice(0, 6)}`, title: "New promotion", href: "/categories/all" }] })}
        >
          <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          Add
        </Button>
      </div>
      {section.tiles.map((tile, index) => (
        <div key={tile.id} className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-3">
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
          <StudioTextField label="Image URL" value={tile.imageUrl ?? ""} inputMode="url" onChange={(e) => patchTile(tile.id, { imageUrl: e.target.value || undefined })} />
          <StudioTextField label="Link" hint="Internal path, e.g. /categories/all" value={tile.href} onChange={(e) => patchTile(tile.id, { href: e.target.value })} />
        </div>
      ))}
    </div>
  )
}

function ValueItemsEditor({ section, onChange }: { section: Extract<HomeSection, { type: "value_grid" }>; onChange: (section: HomeSection) => void }) {
  const patchItem = (id: string, values: Partial<(typeof section.items)[number]>) => onChange({ ...section, items: section.items.map((item) => item.id === id ? { ...item, ...values } : item) })
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Cards ({section.items.length}/4)</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={section.items.length >= 4}
          onClick={() => onChange({ ...section, items: [...section.items, { id: `${section.id}-${crypto.randomUUID().slice(0, 6)}`, title: "New value", body: "Explain the customer benefit." }] })}
        >
          <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          Add
        </Button>
      </div>
      {section.items.map((item, index) => (
        <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-border p-3">
          <StudioTextField label={`Card ${index + 1} title`} value={item.title} maxLength={80} onChange={(e) => patchItem(item.id, { title: e.target.value })} />
          <StudioTextareaField label="Description" rows={2} value={item.body} maxLength={180} onChange={(e) => patchItem(item.id, { body: e.target.value })} />
        </div>
      ))}
    </div>
  )
}
