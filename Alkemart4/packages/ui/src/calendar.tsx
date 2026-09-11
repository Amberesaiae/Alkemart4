import * as React from "react"
import { CaretLeft, CaretRight } from "@phosphor-icons/react"
import {
  addMonths,
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

export interface CalendarProps {
  className?: string
  mode?: "single"
  selected?: Date | null
  onSelect?: (date: Date | undefined) => void
  disabled?: (date: Date) => boolean
  minDate?: Date
  maxDate?: Date
  initialMonth?: Date
}

export function Calendar({
  className,
  selected,
  onSelect,
  disabled,
  minDate,
  maxDate,
  initialMonth,
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

  return (
    <div className={cn("p-3 w-[280px] select-none space-y-3 bg-card text-card-foreground rounded-2xl", className)}>
      {/* Header with Navigation */}
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-bold text-foreground">
          {format(currentMonth, "MMMM yyyy")}
        </span>
        <div className="flex items-center gap-1">
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
              aria-selected={isSelected}
              aria-disabled={isDisabled}
              className={cn(
                "h-8 w-8 rounded-lg text-xs font-medium flex items-center justify-center transition-all cursor-pointer",
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
