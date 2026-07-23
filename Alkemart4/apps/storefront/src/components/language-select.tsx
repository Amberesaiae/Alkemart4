import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import {
  LANGUAGES,
  applyLanguage,
  languageLabel,
  readStoredLanguage,
} from "@/lib/languages"

type Props = {
  className?: string
  /** denser control for compact headers */
  compact?: boolean
}

/**
 * Seller Hub–style language control: globe + current name + dropdown.
 */
export function LanguageSelect({ className, compact }: Props) {
  const [code, setCode] = useState("en")
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const initial = readStoredLanguage()
    setCode(initial)
    applyLanguage(initial)
  }, [])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onKey)
    }
  }, [])

  const sorted = [...LANGUAGES].sort((a, b) =>
    a.display_name.localeCompare(b.display_name),
  )

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground",
          compact ? "h-9 px-2" : "h-10 px-2.5",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-testid="auth-language-select-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        <IconGlobe className="h-4 w-4 shrink-0" />
        <span className={cn(compact && "hidden sm:inline")}>
          {languageLabel(code)}
        </span>
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Language"
          className="absolute right-0 z-50 mt-1 max-h-[300px] min-w-[11rem] overflow-y-auto border border-border bg-card py-1 shadow-md"
        >
          {sorted.map((lang) => (
            <button
              key={lang.code}
              type="button"
              role="option"
              aria-selected={lang.code === code}
              data-testid={`auth-language-select-option-${lang.code}`}
              className={cn(
                "block w-full px-3 py-2 text-left text-sm transition hover:bg-muted",
                lang.code === code && "bg-primary/15 font-semibold",
              )}
              onClick={() => {
                setCode(lang.code)
                applyLanguage(lang.code)
                setOpen(false)
              }}
            >
              {lang.display_name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function IconGlobe({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18" />
      <path d="M12 3a14 14 0 0 0 0 18" />
    </svg>
  )
}
