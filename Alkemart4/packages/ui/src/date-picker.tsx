import * as React from "react"
import { CalendarBlank } from "@phosphor-icons/react"
import { format } from "date-fns"
import { cn } from "./cn"
import { Button } from "./button"
import { Calendar } from "./calendar"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

export interface DatePickerProps {
  date?: Date | string | null
  value?: Date | string | null
  onDateChange?: (date: Date | undefined) => void
  onChange?: (date: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
  "aria-describedby"?: string
  "aria-invalid"?: boolean
  minDate?: Date
  maxDate?: Date
}

export function DatePicker({
  date,
  value,
  onDateChange,
  onChange,
  placeholder = "Select date",
  disabled = false,
  className,
  id,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  minDate,
  maxDate,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  const activeDate = date ?? value
  const handleDateChange = onDateChange ?? onChange

  const parsedDate = React.useMemo(() => {
    if (!activeDate) return undefined
    if (activeDate instanceof Date) return isNaN(activeDate.getTime()) ? undefined : activeDate
    const d = new Date(activeDate)
    return isNaN(d.getTime()) ? undefined : d
  }, [activeDate])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          className={cn(
            "w-full justify-start text-left font-medium h-10 px-3 border-input bg-background hover:bg-muted/50 rounded-lg",
            !parsedDate && "text-muted-foreground font-normal",
            className
          )}
        >
          <CalendarBlank className="mr-2 h-4 w-4 text-primary shrink-0" />
          {parsedDate ? (
            <span className="truncate text-foreground font-semibold">
              {format(parsedDate, "PPP")}
            </span>
          ) : (
            <span className="truncate">{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 border border-border shadow-lg rounded-lg bg-card" align="start">
        <Calendar
          mode="single"
          selected={parsedDate}
          onSelect={(d) => {
            handleDateChange?.(d)
            setOpen(false)
          }}
          disabled={(d) => {
            if (minDate && d < minDate) return true
            if (maxDate && d > maxDate) return true
            return false
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
