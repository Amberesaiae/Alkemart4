import { useId, useState } from "react"
import { Link } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { StarIcon } from "@hugeicons/core-free-icons"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { orderFacets, prunedValues, type FacetGroup } from "@/lib/listing/facet-quality"
import { toggleAttributeFacet, type ListingFacetState } from "@/lib/listing/ListingFacets"
import { useMarket } from "@/lib/market"
import { cn } from "@/lib/utils"

export type SellerOption = { handle: string; name: string; count: number }
export type SubCategoryOption = { id: string; label: string; handle: string | null }

function PriceRange({ state, onChange }: { state: ListingFacetState; onChange: (s: ListingFacetState) => void }) {
  const market = useMarket()
  const uid = useId()
  const [min, setMin] = useState(state.priceMin?.toString() ?? "")
  const [max, setMax] = useState(state.priceMax?.toString() ?? "")
  const parse = (v: string) => {
    const n = Number(v.replace(/[^0-9.]/g, ""))
    return v.trim() && Number.isFinite(n) && n >= 0 ? n : null
  }
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        let lo = parse(min)
        let hi = parse(max)
        if (lo != null && hi != null && lo > hi) [lo, hi] = [hi, lo]
        onChange({ ...state, priceMin: lo, priceMax: hi })
      }}
    >
      <div className="flex items-center gap-2">
        <div className="flex-1 space-y-1">
          <Label htmlFor={`${uid}-min`} className="text-xs text-muted-foreground">Min ({market.currency.symbol})</Label>
          <Input id={`${uid}-min`} inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} placeholder="0" />
        </div>
        <span className="pt-5 text-muted-foreground">–</span>
        <div className="flex-1 space-y-1">
          <Label htmlFor={`${uid}-max`} className="text-xs text-muted-foreground">Max ({market.currency.symbol})</Label>
          <Input id={`${uid}-max`} inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} placeholder="Any" />
        </div>
      </div>
      <Button type="submit" variant="secondary" size="sm" className="w-full">
        Apply price
      </Button>
    </form>
  )
}

/**
 * The full filter set. Rendered in the desktop sidebar and inside the phone
 * filter sheet — one component, one state, so they cannot disagree.
 */
export function FilterPanel({
  state,
  onChange,
  slug,
  subCategories,
  sellers,
  attributes,
  resultCount,
}: {
  state: ListingFacetState
  onChange: (s: ListingFacetState) => void
  slug: string
  subCategories: SubCategoryOption[]
  sellers: SellerOption[]
  attributes: FacetGroup[]
  resultCount: number
}) {
  // Rendered twice (sidebar + phone sheet): ids must be unique per instance.
  const uid = useId()
  const facets = orderFacets(attributes, state.attributes, resultCount)
  const open = ["category", "price", "rating", ...(state.sellerHandles.length ? ["sellers"] : []), ...facets.slice(0, 2).map((f) => `attr-${f.code}`)]
  return (
    <Accordion type="multiple" defaultValue={open} className="w-full">
      {subCategories.length > 0 ? (
        <AccordionItem value="category">
          <AccordionTrigger className="font-semibold">Category</AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-0.5">
              {[{ id: "all", label: "All", handle: null }, ...subCategories].map((c) => {
                const active = state.subCategory === c.id
                return (
                  <li key={c.id}>
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => onChange({ ...state, subCategory: c.id })}
                      className={cn(
                        "w-full justify-start whitespace-normal text-left",
                        active ? "bg-muted font-semibold" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {c.label}
                    </Button>
                  </li>
                )
              })}
            </ul>
          </AccordionContent>
        </AccordionItem>
      ) : null}

      <AccordionItem value="price">
        <AccordionTrigger className="font-semibold">Price</AccordionTrigger>
        <AccordionContent>
          <PriceRange key={`${state.priceMin}-${state.priceMax}`} state={state} onChange={onChange} />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="rating">
        <AccordionTrigger className="font-semibold">Customer rating</AccordionTrigger>
        <AccordionContent>
          <RadioGroup
            value={String(state.minRating)}
            onValueChange={(v) => onChange({ ...state, minRating: Number(v) })}
            className="gap-2.5"
          >
            {[0, 4, 3].map((r) => (
              <div key={r} className="flex items-center gap-2.5">
                <RadioGroupItem value={String(r)} id={`${uid}-rating-${r}`} />
                <Label htmlFor={`${uid}-rating-${r}`} className="flex min-h-11 flex-1 cursor-pointer items-center gap-1 font-normal">
                  {r === 0 ? (
                    "Any rating"
                  ) : (
                    <>
                      <HugeiconsIcon icon={StarIcon} className="size-4 fill-star text-star" /> {r} & up
                    </>
                  )}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </AccordionContent>
      </AccordionItem>

      {sellers.length > 0 ? (
        <AccordionItem value="sellers">
          <AccordionTrigger className="font-semibold">Sellers</AccordionTrigger>
          <AccordionContent>
            <ul className="max-h-64 space-y-2.5 overflow-y-auto pr-1">
              {sellers.map((s) => {
                const checked = state.sellerHandles.includes(s.handle)
                return (
                  <li key={s.handle} className="flex items-center gap-2.5">
                    <Checkbox
                      id={`${uid}-seller-${s.handle}`}
                      checked={checked}
                      onCheckedChange={(v) =>
                        onChange({
                          ...state,
                          sellerHandles: v
                            ? [...state.sellerHandles, s.handle]
                            : state.sellerHandles.filter((h) => h !== s.handle),
                        })
                      }
                    />
                    <Label htmlFor={`${uid}-seller-${s.handle}`} className="min-h-11 flex-1 cursor-pointer truncate font-normal">
                      {s.name}
                    </Label>
                    {s.count ? <span className="text-xs text-muted-foreground tabular">{s.count}</span> : null}
                  </li>
                )
              })}
            </ul>
          </AccordionContent>
        </AccordionItem>
      ) : null}

      {facets.map((f) => (
        <AccordionItem key={f.code} value={`attr-${f.code}`}>
          <AccordionTrigger className="font-semibold">{f.label}</AccordionTrigger>
          <AccordionContent>
            <ul className="max-h-64 space-y-2.5 overflow-y-auto pr-1">
              {prunedValues(f.values, state.attributes[f.code]).map(([value, count]) => {
                const checked = state.attributes[f.code]?.includes(value) ?? false
                const id = `${uid}-attr-${f.code}-${value}`.replace(/[^\w:-]+/g, "-")
                return (
                  <li key={value} className="flex items-center gap-2.5">
                    <Checkbox id={id} checked={checked} onCheckedChange={() => onChange(toggleAttributeFacet(state, f.code, value))} />
                    <Label htmlFor={id} className="min-h-11 flex-1 cursor-pointer truncate font-normal">
                      {value}
                    </Label>
                    <span className="text-xs text-muted-foreground tabular">{count}</span>
                  </li>
                )
              })}
            </ul>
          </AccordionContent>
        </AccordionItem>
      ))}

      {slug !== "all" ? (
        <div className="border-t border-border p-4">
          <Button asChild variant="outline" className="w-full">
          <Link to="/categories">
            ← All categories
          </Link>
          </Button>
        </div>
      ) : null}
    </Accordion>
  )
}
