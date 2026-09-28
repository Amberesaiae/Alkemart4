import { Link, createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { CheckmarkCircle02Icon, StarIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/console-ui/components/button"
import { Skeleton } from "@workspace/console-ui/components/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@workspace/console-ui/components/tabs"
import { PageHeader } from "@workspace/console-ui/components/console/page-header"
import { EmptyState, ErrorState } from "@workspace/console-ui/components/console/states"
import { timeAgo } from "@workspace/console-ui/lib/money"
import { cn } from "@workspace/console-ui/lib/utils"
import { listBuyerReviews, moderateReview, type BuyerReview } from "@/lib/ops"

type View = "waiting" | "live"

export const Route = createFileRoute("/_app/buyer-reviews")({
  validateSearch: (s: Record<string, unknown>): { view?: View } => ({ view: s.view === "live" ? "live" : undefined }),
  component: ReviewsPage,
})

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
  const { view = "waiting" } = Route.useSearch()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ["reviews", view, "full"], queryFn: () => listBuyerReviews(view), staleTime: 20_000 })
  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "publish" | "hide" }) => moderateReview(id, action),
    onSuccess: (_r, v) => {
      void qc.invalidateQueries({ queryKey: ["reviews"] })
      toast.success(v.action === "publish" ? "Published." : "Hidden.")
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't save."),
  })
  const rows = (q.data ?? []).filter((r) => r.status === (view === "live" ? "published" : "pending"))
  return (
    <div className="space-y-6">
      <PageHeader
        title="Buyer reviews"
        description="Reviews from verified buyers show at once. Ones with phone numbers, links or off-app deals wait here. Publish honest ones — including bad ones. Hide only abuse, spam or contact details."
      />
      <Tabs value={view}>
        <TabsList className="h-auto w-full justify-start sm:w-auto">
          <TabsTrigger value="waiting" asChild className="min-h-11 px-3">
            <Link to="/buyer-reviews" search={{}} replace>
              Waiting
            </Link>
          </TabsTrigger>
          <TabsTrigger value="live" asChild className="min-h-11 px-3">
            <Link to="/buyer-reviews" search={{ view: "live" }} replace>
              Live
            </Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {q.isPending ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : q.isError ? (
        <ErrorState title="Reviews didn't load" error={q.error} onRetry={() => void q.refetch()} className="rounded-2xl border bg-card" />
      ) : rows.length === 0 ? (
        <EmptyState icon={CheckmarkCircle02Icon} title={view === "live" ? "No reviews yet" : "No reviews waiting"} className="rounded-2xl border bg-card" />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
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
                  {view === "waiting" ? (
                    <Button variant="brand" disabled={act.isPending} onClick={() => act.mutate({ id: r.id, action: "publish" })}>
                      Publish
                    </Button>
                  ) : null}
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
