import { useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"
import { Button } from "@workspace/console-ui/components/button"
import { Skeleton } from "@workspace/console-ui/components/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@workspace/console-ui/components/tabs"
import { ChatMessages } from "@workspace/console-ui/components/console/chat"
import { PageHeader } from "@workspace/console-ui/components/console/page-header"
import { EmptyState, ErrorState } from "@workspace/console-ui/components/console/states"
import { timeAgo } from "@workspace/console-ui/lib/money"
import { cn } from "@workspace/console-ui/lib/utils"
import { listAdminQuestions, listReported, readReported, resolveReport, setQuestionHidden, type ReportedThread } from "@/lib/messages"

type Tab = "reported" | "questions"
export const Route = createFileRoute("/_app/messages")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } => ({ tab: s.tab === "questions" ? "questions" : undefined }),
  component: MessagesPage,
})

function MessagesPage() {
  const { tab = "reported" } = Route.useSearch()
  return (
    <div className="space-y-5">
      <PageHeader title="Messages" description="Conversations are private. You only see ones a buyer or seller reported — opening one is audit-logged." />
      <Tabs value={tab}>
        <TabsList>
          <TabsTrigger value="reported" asChild className="min-h-11 px-4">
            <Link to="/messages" search={{}} replace>
              Reported
            </Link>
          </TabsTrigger>
          <TabsTrigger value="questions" asChild className="min-h-11 px-4">
            <Link to="/messages" search={{ tab: "questions" }} replace>
              Product questions
            </Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "questions" ? <Questions /> : <Reported />}
    </div>
  )
}

function Reported() {
  const q = useQuery({ queryKey: ["reported-messages"], queryFn: listReported, staleTime: 20_000 })
  const [open, setOpen] = useState<string | null>(null)
  if (q.isPending) return <Skeleton className="h-40 rounded-2xl" />
  if (q.isError) return <ErrorState title="Reports didn't load" error={q.error} onRetry={() => void q.refetch()} className="rounded-2xl border bg-card" />
  if (!q.data.items.length) return <EmptyState icon={CheckmarkCircle02Icon} title="No reported conversations" className="rounded-2xl border bg-card" />
  return (
    <ul className="space-y-3">
      {q.data.items.map((t) => (
        <li key={t.id} className="overflow-hidden rounded-2xl border bg-card">
          <button type="button" aria-expanded={open === t.id} onClick={() => setOpen(open === t.id ? null : t.id)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/40">
            <span className="min-w-0 flex-1 space-y-1">
              <span className="block font-bold">
                {t.buyerName} ↔ {t.sellerName ?? "Seller"}
                <span className="font-normal text-muted-foreground"> · {t.orderReference ? `Order ${t.orderReference}` : (t.productTitle ?? "General")}</span>
              </span>
              <span className="block text-[15px] [overflow-wrap:anywhere]">
                Reported by the {t.reportedBy}: “{t.reportReason}”
              </span>
              <span className="block text-sm text-muted-foreground">{t.reportedAt ? timeAgo(t.reportedAt) : ""}</span>
            </span>
            <HugeiconsIcon icon={ArrowDown01Icon} className={cn("size-5 shrink-0 text-muted-foreground transition-transform", open === t.id && "rotate-180")} aria-hidden />
          </button>
          {open === t.id ? <ReportedThreadView t={t} /> : null}
        </li>
      ))}
    </ul>
  )
}

function ReportedThreadView({ t }: { t: ReportedThread }) {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ["reported-message", t.id], queryFn: () => readReported(t.id) })
  const m = useMutation({
    mutationFn: (action: "dismiss" | "close") => resolveReport(t.id, action),
    onSuccess: (_d, action) => {
      toast.success(action === "close" ? "Conversation closed for both sides." : "Report dismissed.")
      void qc.invalidateQueries({ queryKey: ["reported-messages"] })
    },
    onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "Couldn't save."),
  })
  if (q.isPending) return <Skeleton className="m-4 h-40 rounded-2xl" />
  if (q.isError) return <ErrorState title="Couldn't open the conversation" error={q.error} />
  return (
    <div className="space-y-4 border-t p-4">
      <ChatMessages messages={q.data.messages} me="seller" labels={{ buyer: t.buyerName, seller: t.sellerName ?? "Seller" }} />
      <div className="flex flex-wrap gap-2">
        <Button variant="destructive" disabled={m.isPending} onClick={() => m.mutate("close")}>
          Close the conversation
        </Button>
        <Button variant="outline" disabled={m.isPending} onClick={() => m.mutate("dismiss")}>
          Nothing wrong — dismiss
        </Button>
      </div>
    </div>
  )
}

function Questions() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ["admin-questions"], queryFn: listAdminQuestions, staleTime: 20_000 })
  const m = useMutation({
    mutationFn: (x: { id: string; hide: boolean }) => setQuestionHidden(x.id, x.hide),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin-questions"] }),
    onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "Couldn't save."),
  })
  if (q.isPending) return <Skeleton className="h-40 rounded-2xl" />
  if (q.isError) return <ErrorState title="Questions didn't load" error={q.error} onRetry={() => void q.refetch()} className="rounded-2xl border bg-card" />
  if (!q.data.items.length) return <EmptyState icon={CheckmarkCircle02Icon} title="No product questions yet" className="rounded-2xl border bg-card" />
  return (
    <ul className="divide-y rounded-2xl border bg-card">
      {q.data.items.map((x) => (
        <li key={x.id} className="flex flex-wrap items-start gap-3 p-4">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm text-muted-foreground">
              {x.askerName} → {x.sellerName ?? "Seller"} · {timeAgo(x.askedAt)}
              {x.hidden ? " · hidden" : ""}
            </p>
            <p className="font-semibold [overflow-wrap:anywhere]">{x.question}</p>
            <p className="text-[15px] [overflow-wrap:anywhere]">{x.answer ?? <span className="text-muted-foreground">Not answered yet</span>}</p>
          </div>
          <Button variant="outline" size="sm" disabled={m.isPending} onClick={() => m.mutate({ id: x.id, hide: !x.hidden })}>
            {x.hidden ? "Show" : "Hide"}
          </Button>
        </li>
      ))}
    </ul>
  )
}
