import { Link, useNavigate, useRouterState } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { JusticeScale01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { useSession } from "@/hooks/use-store"
import { getCompareTokens, openComparison } from "@/lib/compare"
import { cn } from "@/lib/utils"

import { COMPARE_MAX as MAX } from "@/lib/compare-picker"

/** Shown while Compare is held back: says it's on its way, does nothing. */
export function CompareSoon() {
  return (
    <p className="inline-flex min-h-10 items-center gap-2 rounded-full border border-dashed px-4 text-sm font-semibold text-muted-foreground">
      <HugeiconsIcon icon={JusticeScale01Icon} className="size-5" aria-hidden />
      Compare products side by side — coming soon
    </p>
  )
}

/** The ⚖ switch that turns Compare mode on for these results. */
export function CompareToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        "inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-bold transition-colors",
        on ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-muted",
      )}
    >
      <HugeiconsIcon icon={JusticeScale01Icon} className="size-5" aria-hidden />
      Compare
    </button>
  )
}

/**
 * Floating bar while Compare mode is on: how many are picked, compares left,
 * and the button that opens the side-by-side view (uses one compare).
 */
export function CompareBar({ selected, onClear }: { selected: string[]; onClear: () => void }) {
  const session = useSession()
  const signedIn = !!session.data
  const qc = useQueryClient()
  const navigate = useNavigate()
  const here = useRouterState({ select: (s) => s.location.href })
  const tokens = useQuery({ queryKey: ["store", "compare", "tokens"], queryFn: getCompareTokens, enabled: signedIn, staleTime: 30_000 })
  const open = useMutation({
    mutationFn: () => openComparison(selected),
    onSuccess: (r) => {
      qc.setQueryData(["store", "compare", "tokens"], r.tokens)
      void navigate({ to: "/compare/$id", params: { id: r.id } })
    },
    onError: (e: unknown) => toast.error((e as Error).message || "That didn't open. Try again."),
  })
  const left = tokens.data?.balance
  const ready = selected.length >= 2

  return (
    <div className="fixed inset-x-3 bottom-[4.75rem] z-40 md:bottom-6 md:left-auto md:right-6 md:w-[26rem]">
      <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-2xl border bg-background p-3 shadow-lg">
        <HugeiconsIcon icon={JusticeScale01Icon} className="size-6 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-bold">
            {selected.length} of {MAX} picked
          </p>
          <p className="text-muted-foreground">
            {!signedIn
              ? "Sign in to compare — you get free compares."
              : left == null
                ? " "
                : left > 0
                  ? `${left} compare${left === 1 ? "" : "s"} left`
                  : "No compares left for now."}
          </p>
        </div>
        {selected.length ? (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear
          </Button>
        ) : null}
        {signedIn ? (
          <Button disabled={!ready || open.isPending || left === 0} onClick={() => open.mutate()}>
            Compare
          </Button>
        ) : (
          <Button asChild>
            <Link to="/login" search={{ redirect: here }}>
              Sign in
            </Link>
          </Button>
        )}
      </div>
    </div>
  )
}
