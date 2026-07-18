import { cn } from "@/lib/utils"

const inputClass =
  "h-12 min-h-12 w-full rounded-xl border border-border bg-background px-3.5 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-foreground focus:ring-2 focus:ring-foreground/10"

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
      <label className="text-xs font-semibold text-foreground" htmlFor={id}>
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
      <label className="text-xs font-semibold" htmlFor={id}>
        {props.label}
      </label>
      {props.error ? (
        <p className="text-xs text-destructive">{props.error}</p>
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
