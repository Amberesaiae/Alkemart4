import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { subscribeNewsletter } from "@/lib/newsletter"
import { cn } from "@/lib/utils"

/**
 * Footer signup. Double opt-in: we say "check your inbox", never "you're
 * subscribed", because nothing is sent until they confirm.
 */
export function NewsletterForm({ tone = "light", source }: { tone?: "light" | "dark"; source: string }) {
  const [email, setEmail] = useState("")
  const m = useMutation({ mutationFn: () => subscribeNewsletter(email.trim(), source) })
  const dark = tone === "dark"
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
      <label htmlFor={`nl-${source}`} className={cn("block text-sm font-semibold", dark ? "text-white" : "text-foreground")}>
        Deals and new shops, once a week
      </label>
      <div className="flex gap-2">
        <input
          id={`nl-${source}`}
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-invalid={m.isError || undefined}
          aria-describedby={`nl-${source}-hint`}
          className={cn(
            "h-11 min-w-0 flex-1 rounded-full border px-4 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
            dark ? "border-white/20 bg-white/10 text-white placeholder:text-white/50" : "border-border bg-background",
          )}
        />
        <button
          type="submit"
          disabled={m.isPending}
          className="h-11 shrink-0 rounded-full bg-brand px-5 text-sm font-bold text-brand-foreground hover:brightness-95 disabled:opacity-60"
        >
          {m.isPending ? "Sending…" : "Sign up"}
        </button>
      </div>
      <p id={`nl-${source}-hint`} className={cn("text-xs", m.isError ? "text-destructive" : dark ? "text-white/60" : "text-muted-foreground")}>
        {m.isError ? (m.error instanceof Error ? m.error.message : "That didn't work — try again.") : "No spam. Unsubscribe in one tap."}
      </p>
    </form>
  )
}
