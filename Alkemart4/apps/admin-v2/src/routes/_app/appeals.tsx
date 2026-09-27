import { useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { ImageNotFound01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@workspace/console-ui/components/button"
import { Label } from "@workspace/console-ui/components/label"
import { Skeleton } from "@workspace/console-ui/components/skeleton"
import { Spinner } from "@workspace/console-ui/components/spinner"
import { Textarea } from "@workspace/console-ui/components/textarea"
import { PageHeader } from "@workspace/console-ui/components/console/page-header"
import { EmptyState, ErrorState } from "@workspace/console-ui/components/console/states"
import { timeAgo } from "@workspace/console-ui/lib/money"
import { listAppealsFull, resolveAppeal, type Appeal } from "@/lib/ops"

export const Route = createFileRoute("/_app/appeals")({ component: AppealsPage })

function AppealsPage() {
  const q = useQuery({ queryKey: ["appeals-full"], queryFn: listAppealsFull, staleTime: 20_000 })
  return (
    <div className="space-y-6">
      <PageHeader title="Appeals" description="Sellers asking for a second look at a rejected listing. Oldest first." />
      {q.isPending ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : q.isError ? (
        <ErrorState title="Appeals didn't load" error={q.error} onRetry={() => void q.refetch()} className="rounded-2xl border bg-card" />
      ) : q.data.length === 0 ? (
        <EmptyState icon={CheckmarkCircle02Icon} title="No open appeals" className="rounded-2xl border bg-card" />
      ) : (
        <ul className="space-y-3">
          {[...q.data]
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
            .map((a) => (
              <AppealCard key={a.id} a={a} />
            ))}
        </ul>
      )}
    </div>
  )
}

function AppealCard({ a }: { a: Appeal }) {
  const qc = useQueryClient()
  const [note, setNote] = useState("")
  const decide = useMutation({
    mutationFn: (d: "reopen" | "uphold") => resolveAppeal(a.id, d, note.trim() || null),
    onSuccess: (_r, d) => {
      void qc.invalidateQueries({ queryKey: ["appeals-full"] })
      void qc.invalidateQueries({ queryKey: ["appeals"] })
      void qc.invalidateQueries({ queryKey: ["listings"] })
      toast.success(d === "reopen" ? "Back in the review queue." : "Decision kept. The seller sees your note.")
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't save."),
  })
  return (
    <li className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex gap-3">
        <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted">
          {a.product?.imageUrl ? <img src={a.product.imageUrl} alt="" className="size-full object-cover" /> : <HugeiconsIcon icon={ImageNotFound01Icon} className="size-6 text-muted-foreground" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{a.product?.title ?? "Listing"}</p>
          <p className="text-sm text-muted-foreground">
            {a.seller?.name ?? "Shop"} · {timeAgo(a.createdAt)} ·{" "}
            <Link to="/listings" search={{ tab: "rejected" }} className="underline">
              see the listing
            </Link>
          </p>
        </div>
      </div>
      <blockquote className="rounded-xl bg-muted p-3 text-[15px]">“{a.message}”</blockquote>
      <div className="space-y-1.5">
        <Label htmlFor={`note-${a.id}`}>Note to the seller</Label>
        <Textarea id={`note-${a.id}`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Explain your decision — they'll read it." />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="brand" disabled={decide.isPending} onClick={() => decide.mutate("reopen")}>
          {decide.isPending ? <Spinner /> : null} Reopen for review
        </Button>
        <Button variant="outline" disabled={decide.isPending || !note.trim()} onClick={() => decide.mutate("uphold")}>
          Keep rejected
        </Button>
      </div>
      {!note.trim() ? <p className="text-xs text-muted-foreground">Keeping a rejection needs a note, so the seller knows why.</p> : null}
    </li>
  )
}
