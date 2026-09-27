"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon, ArrowRight01Icon, Calendar03Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@workspace/console-ui/components/button"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/console-ui/components/popover"
import { cn } from "@workspace/console-ui/lib/utils"

/**
 * Friendly date / date-time picking — never the browser's
 * "mm/dd/yyyy, --:-- --" box. Quick picks for the common cases, a calendar
 * for the rest, and times as a readable list. Values:
 *   DateTimePicker → ISO string (UTC) or null
 *   DatePicker     → "YYYY-MM-DD" or null
 *   TimeSelect     → "HH:MM" (24h)
 */

const DAY = 86_400_000
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const at = (d: Date, h: number, m = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m)
const nextWeekday = (from: Date, weekday: number) => {
  const d = startOfDay(from)
  const add = (weekday - d.getDay() + 7) % 7 || 7
  return new Date(d.getTime() + add * DAY)
}
const pad = (n: number) => String(n).padStart(2, "0")
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fromYmd = (s: string) => {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y!, (m ?? 1) - 1, d ?? 1)
}

export function formatTime(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number)
  const hour = ((h ?? 0) % 12) || 12
  return `${hour}:${pad(m ?? 0)} ${(h ?? 0) < 12 ? "AM" : "PM"}`
}
const niceDate = (d: Date) => d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" })
const niceDateTime = (d: Date) => `${niceDate(d)}, ${formatTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`)}`

const SLOTS = Array.from({ length: 48 }, (_, i) => `${pad(Math.floor(i / 2))}:${i % 2 ? "30" : "00"}`)

// ─── Month grid ─────────────────────────────────────────────────────────

function MonthGrid({ selected, onPick, min }: { selected: Date | null; onPick: (d: Date) => void; min?: Date }) {
  const [view, setView] = React.useState(() => {
    const base = selected ?? new Date()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })
  const today = new Date()
  const lead = (view.getDay() + 6) % 7 // Monday-first
  const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate()
  const cells: (Date | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => new Date(view.getFullYear(), view.getMonth(), i + 1))]
  const minDay = min ? startOfDay(min) : null
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}>
          <HugeiconsIcon icon={ArrowLeft01Icon} />
        </Button>
        <p className="text-sm font-semibold" aria-live="polite">
          {view.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </p>
        <Button variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}>
          <HugeiconsIcon icon={ArrowRight01Icon} />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w) => (
          <span key={w} className="text-xs font-medium text-muted-foreground" aria-hidden>
            {w}
          </span>
        ))}
        {cells.map((d, i) =>
          d ? (
            <button
              key={i}
              type="button"
              disabled={!!minDay && d < minDay}
              aria-pressed={selected ? sameDay(d, selected) : false}
              aria-label={d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              onClick={() => onPick(d)}
              className={cn(
                "grid size-9 place-items-center rounded-full text-sm tabular outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-30",
                sameDay(d, today) && "font-bold underline underline-offset-4",
                selected && sameDay(d, selected) && "bg-foreground text-background hover:bg-foreground/90",
              )}
            >
              {d.getDate()}
            </button>
          ) : (
            <span key={i} aria-hidden />
          ),
        )}
      </div>
    </div>
  )
}

function Trigger({ id, label, placeholder, invalid, className, ...rest }: React.ComponentProps<"button"> & { label: string | null; placeholder: string; invalid?: boolean }) {
  return (
    <button
      id={id}
      type="button"
      aria-invalid={invalid || undefined}
      className={cn(
        "flex h-10 w-full items-center gap-2 rounded-4xl border bg-input/30 px-3 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive",
        !label && "text-muted-foreground",
        className,
      )}
      {...rest}
    >
      <HugeiconsIcon icon={Calendar03Icon} className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{label ?? placeholder}</span>
    </button>
  )
}

// ─── Date + time ────────────────────────────────────────────────────────

export function DateTimePicker({
  id,
  value,
  onChange,
  min,
  placeholder = "Pick a date and time",
  className,
  invalid,
  clearable = true,
}: {
  id?: string
  value: string | null | undefined
  onChange: (iso: string | null) => void
  min?: Date
  placeholder?: string
  className?: string
  invalid?: boolean
  clearable?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const current = value ? new Date(value) : null
  const now = new Date()
  const presets: [string, Date][] = [
    ["Tomorrow, 9 AM", at(new Date(now.getTime() + DAY), 9)],
    ["Friday, 6 PM", at(nextWeekday(now, 5), 18)],
    ["Monday, 9 AM", at(nextWeekday(now, 1), 9)],
    ["In a week", at(new Date(now.getTime() + 7 * DAY), 9)],
  ]
  const pick = (d: Date) => onChange(d.toISOString())
  const time = current ? `${pad(current.getHours())}:${pad(current.getMinutes() - (current.getMinutes() % 30))}` : "09:00"
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Trigger id={id} label={current ? niceDateTime(current) : null} placeholder={placeholder} invalid={invalid} />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto space-y-3 p-3">
          <div className="flex flex-wrap gap-1.5">
            {presets
              .filter(([, d]) => !min || d >= min)
              .map(([label, d]) => (
                <Button key={label} size="sm" variant="outline" onClick={() => (pick(d), setOpen(false))}>
                  {label}
                </Button>
              ))}
          </div>
          <MonthGrid
            selected={current}
            min={min}
            onPick={(d) => {
              const [h, m] = time.split(":").map(Number)
              pick(at(d, h ?? 9, m ?? 0))
            }}
          />
          <label className="flex items-center justify-between gap-3 text-sm font-medium">
            Time
            <select
              value={time}
              disabled={!current}
              onChange={(e) => {
                const [h, m] = e.target.value.split(":").map(Number)
                if (current) pick(at(current, h ?? 9, m ?? 0))
              }}
              className="h-9 rounded-4xl border bg-input/30 px-3 text-sm disabled:opacity-50"
            >
              {SLOTS.map((s) => (
                <option key={s} value={s}>
                  {formatTime(s)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {clearable && current ? (
        <Button variant="ghost" size="icon-sm" aria-label="Clear date" onClick={() => onChange(null)}>
          <HugeiconsIcon icon={Cancel01Icon} />
        </Button>
      ) : null}
    </div>
  )
}

// ─── Date only ──────────────────────────────────────────────────────────

export function DatePicker({
  id,
  value,
  onChange,
  min,
  placeholder = "Pick a date",
  className,
  clearable = true,
}: {
  id?: string
  value: string | null | undefined
  onChange: (ymd: string | null) => void
  min?: Date
  placeholder?: string
  className?: string
  clearable?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const current = value ? fromYmd(value) : null
  const today = startOfDay(new Date())
  const presets: [string, Date][] = [
    ["Tomorrow", new Date(today.getTime() + DAY)],
    ["In 3 days", new Date(today.getTime() + 3 * DAY)],
    ["Next Monday", nextWeekday(today, 1)],
    ["In 2 weeks", new Date(today.getTime() + 14 * DAY)],
  ]
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Trigger id={id} label={current ? niceDate(current) : null} placeholder={placeholder} />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto space-y-3 p-3">
          <div className="flex flex-wrap gap-1.5">
            {presets.map(([label, d]) => (
              <Button key={label} size="sm" variant="outline" onClick={() => (onChange(ymd(d)), setOpen(false))}>
                {label}
              </Button>
            ))}
          </div>
          <MonthGrid selected={current} min={min} onPick={(d) => (onChange(ymd(d)), setOpen(false))} />
        </PopoverContent>
      </Popover>
      {clearable && current ? (
        <Button variant="ghost" size="icon-sm" aria-label="Clear date" onClick={() => onChange(null)}>
          <HugeiconsIcon icon={Cancel01Icon} />
        </Button>
      ) : null}
    </div>
  )
}

// ─── Time only ──────────────────────────────────────────────────────────

export function TimeSelect({ id, value, onChange, className, invalid }: { id?: string; value: string; onChange: (hhmm: string) => void; className?: string; invalid?: boolean }) {
  const options = SLOTS.includes(value) ? SLOTS : [...SLOTS, value].sort()
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid || undefined} className={cn("h-10 rounded-4xl border bg-input/30 px-3 text-sm aria-invalid:border-destructive", className)}>
      {options.map((s) => (
        <option key={s} value={s}>
          {formatTime(s)}
        </option>
      ))}
    </select>
  )
}
