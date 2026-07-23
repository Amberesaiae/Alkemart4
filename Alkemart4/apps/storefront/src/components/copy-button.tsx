import { useState } from "react"
import { Button } from "@/components/ui/button"

type CopyButtonProps = {
  value: string
  label?: string
  className?: string
  size?: "sm" | "default" | "lg"
  variant?: "outline" | "ghost" | "default"
}

export function CopyButton({
  value,
  label = "Copy",
  className,
  size = "sm",
  variant = "outline",
}: CopyButtonProps) {
  const [ok, setOk] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setOk(true)
      window.setTimeout(() => setOk(false), 2000)
    } catch {
      /* fallback */
      const ta = document.createElement("textarea")
      ta.value = value
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand("copy")
        setOk(true)
        window.setTimeout(() => setOk(false), 2000)
      } finally {
        document.body.removeChild(ta)
      }
    }
  }

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      onClick={() => void copy()}
    >
      {ok ? "Copied" : label}
    </Button>
  )
}
