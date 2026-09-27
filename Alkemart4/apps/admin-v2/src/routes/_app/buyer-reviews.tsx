import { createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { CheckmarkCircle02Icon, StarIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/console-ui/components/button"
import { Skeleton } from "@workspace/console-ui/components/skeleton"
import { PageHeader } from "@workspace/console-ui/components/console/page-header"
import { EmptyState, ErrorState } from "@workspace/console-ui/components/console/states"
import { timeAgo } from "@workspace/console-ui/lib/money"
import { cn } from "@workspace/console-ui/lib/utils"
import { listBuyerReviews, moderateReview, type BuyerReview } from "@/lib/ops"

export const Route = createFileRoute("/_app/buyer-reviews")({ component: ReviewsPage })

/** Flags a moderator should notice before publishing (not auto-decisions). */
function flagsOf(r: BuyerReview) {
  const text = `${r.title ?? ""} ${r.body}`.toLowerCase()
  const out: string[] = []
  if (/(\+?233|0)\d{9}|https?:\/\/|www\.|@\w{3,}/.test(text)) out.push("Contains contact details or links")
  if (/whatsapp me|call me|send money|momo pin/.test(text)) out.push("Possible scam wording")
  if (r.body.trim().length < 8) out.push("Very short")
  return out
}

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${n} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <HugeiconsIcon key={i} icon={StarIcon} className={cn("size-4", i <= n ? "fill-brand text-brand" : "text-muted-foreground/40")} aria-hidden />
      ))}
    </span>
  )
}

function ReviewsPage() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ["reviews", "pending", "full"], queryFn: listBuyerReviews, staleTime: 20_000 })
  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "publish" | "hide" }) => moderateReview(id, action),
    onSuccess: (_r, v) => {
      void qc.invalidateQueries({ queryKey: ["reviews"] })
      toast.success(v.action === "publish" ? "Published." : "Hidden.")
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't save."),
  })
  const pending = (q.data ?? []).filter((r) => r.status === "pending")
  return (
    <div className="space-y-6">
      <PageHeader
        title="Buyer reviews"
        description="Reviews from verified buyers wait here before they show. Publish honest ones — including bad ones. Hide only abuse, spam or contact details."
      />
      {q.isPending ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : q.isError ? (
        <ErrorState title="Reviews didn't load" error={q.error} onRetry={() => void q.refetch()} className="rounded-2xl border bg-card" />
      ) : pending.length === 0 ? (
        <EmptyState icon={CheckmarkCircle02Icon} title="No reviews waiting" className="rounded-2xl border bg-card" />
      ) : (
        <ul className="space-y-3">
          {pending.map((r) => {
            const flags = flagsOf(r)
            return (
              <li key={r.id} className="space-y-2 rounded-2xl border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Stars n={r.rating} />
                  <span className="text-sm text-muted-foreground">
                    {r.seller?.name ?? "Shop"} · {timeAgo(r.createdAt)}
                  </span>
                </div>
                {r.title ? <p className="font-semibold">{r.title}</p> : null}
                <p className="text-[15px] whitespace-pre-line">{r.body}</p>
                {flags.length ? <p className="rounded-xl bg-warning-soft p-2.5 text-sm text-warning">{flags.join(" · ")}</p> : null}
                <div className="flex gap-2">
                  <Button variant="brand" disabled={act.isPending} onClick={() => act.mutate({ id: r.id, action: "publish" })}>
                    Publish
                  </Button>
                  <Button variant="outline" disabled={act.isPending} onClick={() => act.mutate({ id: r.id, action: "hide" })}>
                    Hide
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
