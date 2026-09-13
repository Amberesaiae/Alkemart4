import * as React from "react"
import { CalendarBlank } from "@phosphor-icons/react"
import { format } from "date-fns"
import { cn } from "./cn"
import { Button } from "./button"
import { Calendar } from "./calendar"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { Separator } from "./separator"

const TIME_PRESETS = [
  { label: "Morning", detail: "9:00 AM", hour: 9 },
  { label: "Midday", detail: "12:00 PM", hour: 12 },
  { label: "Evening", detail: "6:00 PM", hour: 18 },
] as const

export function formatSchedule(iso: string | null | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return format(date, "MMM d · h:mm a")
}

export interface SchedulePickerProps {
  /** ISO datetime value. Null means unset. */
  value: string | null
  onChange: (value: string | null) => void
  /** Disables dates before this day. */
  minDate?: Date
  placeholder?: string
  /** Accessible name for the trigger button. */
  label: string
  /** When visible label text exists elsewhere, reference it instead. */
  labelledBy?: string
  describedBy?: string
  className?: string
}

/**
 * Click-and-choose scheduling shared by every studio surface.
 * Calendar popup with month/year dropdowns for far jumps, time-of-day
 * presets instead of fiddly time inputs, and past dates rolled forward
 * to the next full hour. No datetime-local clutter.
 */
export function SchedulePicker({
  value,
  onChange,
  minDate,
  placeholder = "Choose date",
  label,
  labelledBy,
  describedBy,
  className,
}: SchedulePickerProps) {
  const [open, setOpen] = React.useState(false)
  const current = value ? new Date(value) : undefined
  const shown = formatSchedule(value)

  const pickDate = (date: Date | undefined) => {
    if (!date) return
    // Preserve the existing time of day; default to 9 AM for a fresh pick.
    const base = current && !Number.isNaN(current.getTime()) ? current : new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0, 0, 0)
    let next = new Date(date.getFullYear(), date.getMonth(), date.getDate(), base.getHours(), base.getMinutes(), 0, 0)
    // Never schedule in the past: roll forward to the next full hour.
    if (next <= new Date()) {
      const ahead = new Date(Date.now() + 3_600_000)
      next = new Date(ahead.getFullYear(), ahead.getMonth(), ahead.getDate(), ahead.getHours(), 0, 0, 0)
    }
    onChange(next.toISOString())
  }

  const pickTime = (hour: number) => {
    const base = current && !Number.isNaN(current.getTime()) ? current : new Date()
    const next = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour, 0, 0, 0)
    onChange(next.toISOString())
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={labelledBy ? undefined : label}
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          className={cn("h-10 flex-1 justify-start px-3 font-medium", !shown && "font-normal text-muted-foreground", className)}
        >
          <CalendarBlank className="mr-2 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate">{shown ?? placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <Calendar
          mode="single"
          captionDropdowns
          selected={current}
          minDate={minDate}
          onSelect={pickDate}
        />
        <Separator className="my-3" />
        <div role="group" aria-label="Time of day" className="flex gap-1.5">
          {TIME_PRESETS.map((preset) => {
            const active = Boolean(current && !Number.isNaN(current.getTime()) && current.getHours() === preset.hour && current.getMinutes() === 0)
            return (
              <Button
                key={preset.label}
                type="button"
                variant={active ? "default" : "outline"}
                size="sm"
                aria-pressed={active}
                title={preset.detail}
                onClick={() => pickTime(preset.hour)}
              >
                {preset.label}
              </Button>
            )
          })}
        </div>
        <div className="mt-3 flex gap-2">
          <Button type="button" variant="outline" size="sm" className="flex-1" disabled={!value} onClick={() => { onChange(null); setOpen(false) }}>
            Clear
          </Button>
          <Button type="button" size="sm" className="flex-1" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
