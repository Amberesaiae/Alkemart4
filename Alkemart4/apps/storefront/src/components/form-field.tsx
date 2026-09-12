import { Input, PasswordInput } from "@workspace/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui"

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
          name={id}
          autoComplete={props.autoComplete ?? "current-password"}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          required={props.required}
          aria-required={props.required || undefined}
          placeholder={props.placeholder}
        />
      ) : (
        <Input
          id={id}
          name={id}
          type={props.type ?? "text"}
          inputMode={props.inputMode}
          autoComplete={props.autoComplete}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          required={props.required}
          aria-required={props.required || undefined}
          placeholder={props.placeholder}
          className="min-h-11"
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
  options: { value: string; label: string }[]
  placeholder?: string
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
        <Select value={props.value} onValueChange={props.onChange} required={props.required}>
          <SelectTrigger id={id} className="min-h-11">
            <SelectValue placeholder={props.placeholder ?? `Select ${props.label.toLowerCase()}…`} />
          </SelectTrigger>
          <SelectContent>
            {props.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
