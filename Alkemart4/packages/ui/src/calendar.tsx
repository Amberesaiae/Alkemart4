import * as React from "react"
import { CaretLeft, CaretRight } from "@phosphor-icons/react"
import {
  addMonths,
  setMonth,
  setYear,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  format,
} from "date-fns"
import { cn } from "./cn"
import { Button } from "./button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select"

export interface CalendarProps {
  className?: string
  mode?: "single"
  selected?: Date | null
  onSelect?: (date: Date | undefined) => void
  disabled?: (date: Date) => boolean
  minDate?: Date
  maxDate?: Date
  initialMonth?: Date
  /**
   * Click-and-choose month/year dropdowns in the caption (Carbon/Syncfusion
   * pattern for jumping to far dates). Defaults to chevron-only navigation.
   */
  captionDropdowns?: boolean
  /** Inclusive year range for the year dropdown. Defaults to [now - 5, now + 10]. */
  yearRange?: [number, number]
}

const MONTHS = Array.from({ length: 12 }, (_, index) => index)

export function Calendar({
  className,
  selected,
  onSelect,
  disabled,
  minDate,
  maxDate,
  initialMonth,
  captionDropdowns = false,
  yearRange,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState<Date>(() => {
    if (selected && !isNaN(selected.getTime())) return startOfMonth(selected)
    if (initialMonth && !isNaN(initialMonth.getTime())) return startOfMonth(initialMonth)
    return startOfMonth(new Date())
  })

  // Sync currentMonth if selected changes to a valid date
  React.useEffect(() => {
    if (selected && !isNaN(selected.getTime())) {
      setCurrentMonth(startOfMonth(selected))
    }
  }, [selected])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart)
  const endDate = endOfWeek(monthEnd)

  const days = React.useMemo(() => {
    return eachDayOfInterval({ start: startDate, end: endDate })
  }, [startDate, endDate])

  const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

  const isDateDisabled = (day: Date): boolean => {
    if (disabled && disabled(day)) return true
    if (minDate && day < minDate && !isSameDay(day, minDate)) return true
    if (maxDate && day > maxDate && !isSameDay(day, maxDate)) return true
    return false
  }

  const currentYear = new Date().getFullYear()
  const [rangeStart, rangeEnd] = yearRange ?? [currentYear - 5, currentYear + 10]
  const years = React.useMemo(() => {
    const list: number[] = []
    for (let year = rangeStart; year <= rangeEnd; year += 1) list.push(year)
    return list
  }, [rangeStart, rangeEnd])

  return (
    <div className={cn("p-3 w-[280px] select-none space-y-3 bg-card text-card-foreground rounded-2xl", className)}>
      {/* Header with Navigation */}
      <div className="flex items-center justify-between gap-1 px-1">
        {captionDropdowns ? (
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <Select
              value={String(currentMonth.getMonth())}
              onValueChange={(value) => setCurrentMonth((prev) => setMonth(prev, Number(value)))}
            >
              <SelectTrigger aria-label="Choose month" className="h-8 flex-1 px-2 text-xs font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {MONTHS.map((month) => (
                    <SelectItem key={month} value={String(month)}>
                      {format(setMonth(new Date(), month), "MMMM")}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Select
              value={String(currentMonth.getFullYear())}
              onValueChange={(value) => setCurrentMonth((prev) => setYear(prev, Number(value)))}
            >
              <SelectTrigger aria-label="Choose year" className="h-8 w-[76px] shrink-0 px-2 text-xs font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {years.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        ) : (
          <span className="text-sm font-bold text-foreground">
            {format(currentMonth, "MMMM yyyy")}
          </span>
        )}
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}
            className="h-7 w-7 rounded-lg border-border hover:bg-muted text-muted-foreground hover:text-foreground"
            aria-label="Previous month"
          >
            <CaretLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
            className="h-7 w-7 rounded-lg border-border hover:bg-muted text-muted-foreground hover:text-foreground"
            aria-label="Next month"
          >
            <CaretRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-[0.75rem] font-bold text-muted-foreground h-8 w-8 flex items-center justify-center"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days Grid */}
      <div className="grid grid-cols-7 gap-1 text-center" role="grid">
        {days.map((day) => {
          const isSelected = selected ? isSameDay(day, selected) : false
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const isCurrentDay = isToday(day)
          const isDisabled = isDateDisabled(day)

          return (
            <button
              key={day.toISOString()}
              type="button"
              disabled={isDisabled}
              onClick={() => {
                if (!isDisabled) {
                  onSelect?.(isSelected ? undefined : day)
                }
              }}
              aria-label={format(day, "EEEE, d MMMM yyyy")}
              aria-selected={isSelected}
              aria-disabled={isDisabled}
              className={cn(
                "h-8 w-8 rounded-lg text-xs font-medium flex items-center justify-center cursor-pointer",
                // Current month vs outside
                isCurrentMonth ? "text-foreground" : "text-muted-foreground/40",
                // Hover effect
                !isSelected && !isDisabled && "hover:bg-muted hover:text-foreground active:scale-95",
                // Today styling
                isCurrentDay && !isSelected && "border border-primary/40 font-bold bg-primary/5 text-primary",
                // Selected styling (shadcn standard)
                isSelected && "bg-primary text-primary-foreground font-bold shadow-xs hover:bg-primary/90",
                // Disabled styling
                isDisabled && "opacity-25 cursor-not-allowed pointer-events-none hover:bg-transparent"
              )}
            >
              {format(day, "d")}
            </button>
          )
        })}
      </div>
    </div>
  )
}
