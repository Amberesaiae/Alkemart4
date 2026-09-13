import * as React from "react"
import { Input } from "./input"
import { Label } from "./label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./select"
import { Textarea } from "./textarea"

export type StudioTheme = "white" | "gold" | "black"

/**
 * Label + control + hint field wrappers shared by every settings surface
 * (admin studios, vendor settings). Each control is programmatically
 * labelled: Input/Textarea via htmlFor, Select via aria-labelledby.
 */

export function StudioTextField({ label, hint, ...props }: React.ComponentProps<typeof Input> & { label: string; hint?: string }) {
  const id = React.useId()
  const hintId = hint ? `${id}-hint` : undefined
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-describedby={hintId} {...props} />
      {hint ? <p id={hintId} className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function StudioTextareaField({ label, hint, ...props }: React.ComponentProps<typeof Textarea> & { label: string; hint?: string }) {
  const id = React.useId()
  const hintId = hint ? `${id}-hint` : undefined
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} aria-describedby={hintId} {...props} />
      {hint ? <p id={hintId} className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function StudioSelect({ label, hint, children, groupLabel, ...props }: React.ComponentProps<typeof Select> & { label: string; hint?: string; groupLabel?: string }) {
  const labelId = React.useId()
  const hintId = hint ? `${labelId}-hint` : undefined
  return (
    <div className="flex flex-col gap-1.5">
      <Label id={labelId}>{label}</Label>
      <Select {...props}>
        <SelectTrigger aria-labelledby={labelId} aria-describedby={hintId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {groupLabel ? <SelectLabel>{groupLabel}</SelectLabel> : null}
            {children}
          </SelectGroup>
        </SelectContent>
      </Select>
      {hint ? <p id={hintId} className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function ThemeField({ value, onChange }: { value: StudioTheme; onChange: (value: StudioTheme) => void }) {
  return (
    <StudioSelect label="Theme" groupLabel="Color theme" value={value} onValueChange={(next) => onChange(next as StudioTheme)}>
      <SelectItem value="white">White</SelectItem>
      <SelectItem value="gold">Gold</SelectItem>
      <SelectItem value="black">Black</SelectItem>
    </StudioSelect>
  )
}
