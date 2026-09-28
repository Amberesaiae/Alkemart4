import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { subscribeNewsletter } from "@/lib/newsletter"
import { cn } from "@/lib/utils"

/**
 * Footer signup. Double opt-in: we say "check your inbox", never "you're
 * subscribed", because nothing is sent until they confirm.
 */
export function NewsletterForm({ tone = "light", source, compact = false }: { tone?: "light" | "dark" | "gold"; source: string; compact?: boolean }) {
  const [email, setEmail] = useState("")
  const m = useMutation({ mutationFn: () => subscribeNewsletter(email.trim(), source) })
  const dark = tone === "dark"
  const gold = tone === "gold"
  if (m.isSuccess) {
    return (
      <p role="status" className={cn("text-sm font-medium", dark ? "text-white" : "text-foreground")}>
        Check your inbox — tap the link we sent to {email.trim()} to confirm.
      </p>
    )
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (email.trim()) m.mutate()
      }}
      className="space-y-2"
    >
      <label htmlFor={`nl-${source}`} className={cn(compact ? "sr-only" : "block text-sm font-semibold", dark ? "text-white" : "text-foreground")}>
        Email address
      </label>
      <div className={cn("flex", compact ? "items-center gap-1 rounded-xl border p-1 focus-within:ring-2 focus-within:ring-brand/70" : "gap-2", compact && (dark ? "border-white/25 bg-white/[0.04]" : "border-border bg-background"))}>
        {compact ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className={cn("ml-3 size-5 shrink-0", dark ? "text-white/60" : "text-muted-foreground")}>
            <rect x="3" y="5" width="18" height="14" rx="3" />
            <path d="m4 7 8 6 8-6" />
          </svg>
        ) : null}
        <input
          id={`nl-${source}`}
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={compact ? "Your email address" : "you@example.com"}
          aria-invalid={m.isError || undefined}
          aria-describedby={`nl-${source}-hint`}
          className={cn(
            "h-11 min-w-0 flex-1 px-4 text-base outline-none",
            compact ? "border-0 bg-transparent px-2 focus-visible:shadow-none focus-visible:outline-none" : "rounded-full border focus-visible:ring-[3px] focus-visible:ring-ring/40",
            dark ? compact ? "text-white placeholder:text-white/60" : "border-white/20 bg-white/10 text-white placeholder:text-white/50" : "border-border",
          )}
        />
        <button
          type="submit"
          disabled={m.isPending}
          className={cn("h-11 shrink-0 px-4 text-sm font-bold hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60", compact ? "rounded-lg" : "rounded-full", gold ? "bg-ink text-white" : "bg-brand text-brand-foreground")}
        >
          {m.isPending ? "Sending…" : "Sign up"}
        </button>
      </div>
      <p id={`nl-${source}-hint`} className={cn("text-xs", gold ? "text-brand-foreground" : m.isError ? "text-destructive" : dark ? "text-white/60" : "text-muted-foreground")}>
        {m.isError ? (m.error instanceof Error ? m.error.message : "That didn't work — try again.") : "No spam. Unsubscribe in one tap."}
      </p>
    </form>
  )
}
