import * as React from "react"
import { Eye, EyeSlash } from "@phosphor-icons/react"
import { cn } from "./cn"

export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {}

/**
 * Accessible password field with show/hide toggle.
 * Toggle is keyboard-focusable; announces state via aria-pressed + aria-label.
 */
const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, id, autoComplete = "current-password", ...props }, ref) => {
    const [visible, setVisible] = React.useState(false)
    const toggleId = id ? `${id}-visibility` : undefined

    return (
      <div className="relative flex items-center w-full">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className={cn(
            "flex h-11 w-full rounded-lg border border-border bg-background pl-4 pr-11 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          ref={ref}
          {...props}
        />
        <button
          type="button"
          id={toggleId}
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          aria-controls={id}
        >
          {visible ? (
            <EyeSlash className="h-4 w-4" weight="bold" aria-hidden />
          ) : (
            <Eye className="h-4 w-4" weight="bold" aria-hidden />
          )}
        </button>
      </div>
    )
  },
)
PasswordInput.displayName = "PasswordInput"

export { PasswordInput }
