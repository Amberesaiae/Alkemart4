import { useEffect, useRef, useState } from "react"
import { cn } from "@workspace/console-ui/lib/utils"
import { Button } from "@workspace/console-ui/components/button"
import { DatePicker } from "@workspace/console-ui/components/console/date-time-picker"
import type { RangePreset, RangeValue } from "@workspace/console-ui/lib/business"

const PRESETS: { preset: RangePreset; label: string }[] = [
  { preset: "7d", label: "7 days" },
  { preset: "30d", label: "30 days" },
  { preset: "90d", label: "3 months" },
  { preset: "12m", label: "12 months" },
  { preset: "ytd", label: "This year" },
]

const same = (a: RangeValue, b: RangeValue) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Pick any period: quick presets, a past calendar year, since joining / all
 * time, or custom dates. Chips scroll sideways on phones (no visible bar);
 * custom dates open inline, not in a pop-up.
 */
export function RangePicker({
  value,
  onChange,
  firstYear,
  longest,
  className,
}: {
  value: RangeValue
  onChange: (v: RangeValue) => void
  /** Earliest year to offer (e.g. the year the shop joined). */
  firstYear: number
  /** The widest option: "since_joined" for a shop, "all" for the platform. */
  longest: { preset: "since_joined" | "all"; label: string }
  className?: string
}) {
  const thisYear = new Date().getFullYear()
  const years = Array.from({ length: Math.max(0, thisYear - firstYear) }, (_, i) => thisYear - 1 - i)
  const custom = "from" in value
  const [editing, setEditing] = useState(custom)
  const [from, setFrom] = useState<string | null>(custom ? value.from : null)
  const [to, setTo] = useState<string | null>(custom ? value.to : null)
  const strip = useRef<HTMLDivElement>(null)
  // Keep the chosen period in view when the chips scroll sideways on phones.
  const current = JSON.stringify(value)
  useEffect(() => {
    strip.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [current])

  const chip = (active: boolean) =>
    cn(
      "inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors",
      active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
    )

  return (
    <div className={cn("space-y-3", className)}>
      <div ref={strip} role="radiogroup" aria-label="Period" className="scroll-quiet -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-1 rounded-full bg-muted p-1">
          {PRESETS.map((p) => (
            <button
              key={p.preset}
              type="button"
              role="radio"
              aria-checked={same(value, { preset: p.preset })}
              className={chip(same(value, { preset: p.preset }))}
              onClick={() => {
                setEditing(false)
                onChange({ preset: p.preset })
              }}
            >
              {p.label}
            </button>
          ))}
          {years.map((y) => (
            <button
              key={y}
              type="button"
              role="radio"
              aria-checked={same(value, { year: y })}
              className={chip(same(value, { year: y }))}
              onClick={() => {
                setEditing(false)
                onChange({ year: y })
              }}
            >
              {y}
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={same(value, { preset: longest.preset })}
            className={chip(same(value, { preset: longest.preset }))}
            onClick={() => {
              setEditing(false)
              onChange({ preset: longest.preset })
            }}
          >
            {longest.label}
          </button>
          <button type="button" role="radio" aria-checked={custom || editing} className={chip(custom || editing)} onClick={() => setEditing(true)}>
            Custom
          </button>
        </div>
      </div>
      {editing ? (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border p-3">
          <div className="space-y-1.5">
            <label htmlFor="range-from" className="block text-sm font-medium">
              From
            </label>
            <DatePicker id="range-from" value={from} onChange={setFrom} clearable={false} placeholder="Start date" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="range-to" className="block text-sm font-medium">
              To
            </label>
            <DatePicker id="range-to" value={to} onChange={setTo} clearable={false} placeholder="End date" />
          </div>
          <Button size="lg" disabled={!from || !to || from > to} onClick={() => from && to && onChange({ from, to })}>
            Show
          </Button>
          {from && to && from > to ? <p className="w-full text-sm text-destructive">The end date is before the start date.</p> : null}
        </div>
      ) : null}
    </div>
  )
}
