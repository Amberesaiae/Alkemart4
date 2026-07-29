import { cn } from "@/lib/utils"
import { Input, PasswordInput, Select } from "@workspace/ui"

const inputClass =
  ""

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
      {props.type === "password" ? (
        <PasswordInput
          id={id}
          autoComplete={props.autoComplete}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          required={props.required}
          aria-required={props.required || undefined}
          placeholder={props.placeholder}
        />
      ) : (
        <Input
          id={id}
          type={props.type ?? "text"}
          inputMode={props.inputMode}
          autoComplete={props.autoComplete}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          required={props.required}
          aria-required={props.required || undefined}
          placeholder={props.placeholder}
        />
      )}
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
        <Select
          id={id}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          required={props.required}
        >
          {props.children}
        </Select>
      )}
    </div>
  )
}
