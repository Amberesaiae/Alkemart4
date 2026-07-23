import { cn } from "@/lib/utils"

const inputClass =
  "h-12 min-h-12 w-full rounded-xl border border-border bg-background px-3.5 text-base sm:text-sm outline-none transition placeholder:text-muted-foreground focus:border-foreground focus:ring-2 focus:ring-foreground/10 focus-visible:ring-2 focus-visible:ring-ring"

export function formInputClassName(extra?: string) {
  return cn(inputClass, extra)
}

type FormFieldProps = {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]
  autoComplete?: string
  required?: boolean
  placeholder?: string
  id?: string
}

export function FormField(props: FormFieldProps) {
  const id =
    props.id ?? `field-${props.label.toLowerCase().replace(/\s+/g, "-")}`
  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-semibold text-foreground" htmlFor={id}>
        {props.label}
      </label>
      <input
        id={id}
        type={props.type ?? "text"}
        inputMode={props.inputMode}
        autoComplete={props.autoComplete}
        className={inputClass}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        required={props.required}
        aria-required={props.required || undefined}
        placeholder={props.placeholder}
      />
    </div>
  )
}

export function FormSelect(props: {
  label: string
  id?: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  children: React.ReactNode
  error?: string
}) {
  const id = props.id ?? `select-${props.label.toLowerCase().replace(/\s+/g, "-")}`
  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-semibold text-foreground" htmlFor={id}>
        {props.label}
      </label>
      {props.error ? (
        <p className="text-sm text-destructive">{props.error}</p>
      ) : (
        <select
          id={id}
          className={inputClass}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          required={props.required}
        >
          {props.children}
        </select>
      )}
    </div>
  )
}
