import { useId, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ViewIcon, ViewOffSlashIcon } from "@hugeicons/core-free-icons"
import { Input } from "@workspace/console-ui/components/input"
import { Label } from "@workspace/console-ui/components/label"

export function PasswordField({
  label = "Password",
  autoComplete,
  value,
  onChange,
  hint,
  invalid,
}: {
  label?: string
  autoComplete: "current-password" | "new-password"
  value: string
  onChange: (v: string) => void
  hint?: string
  invalid?: boolean
}) {
  const id = useId()
  const [show, setShow] = useState(false)
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid || undefined}
          aria-describedby={hint ? `${id}-hint` : undefined}
          required
          className="h-12 pr-12 text-base"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-muted-foreground hover:text-foreground"
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
        >
          <HugeiconsIcon icon={show ? ViewOffSlashIcon : ViewIcon} className="size-5" />
        </button>
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="text-[13px] text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
