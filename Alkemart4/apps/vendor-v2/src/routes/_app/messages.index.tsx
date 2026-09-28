import { useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Message01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@workspace/console-ui/components/button"
import { Skeleton } from "@workspace/console-ui/components/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@workspace/console-ui/components/tabs"
import { PageHeader } from "@workspace/console-ui/components/console/page-header"
import { EmptyState, ErrorState } from "@workspace/console-ui/components/console/states"
import { timeAgo } from "@workspace/console-ui/lib/money"
import { cn } from "@workspace/console-ui/lib/utils"
import { answerQuestion, listQuestions, type SellerQuestion } from "@/lib/api"
import { qk, useInbox } from "@/lib/queries"

type Tab = "chats" | "questions"
export const Route = createFileRoute("/_app/messages/")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } => ({ tab: s.tab === "questions" ? "questions" : undefined }),
  component: MessagesPage,
})

function MessagesPage() {
  const { tab = "chats" } = Route.useSearch()
  const inbox = useInbox()
  const d = inbox.data
  return (
    <div className="space-y-6">
      <PageHeader title="Messages" description={d?.replyTime?.label ? `${d.replyTime.label} — buyers see this on your shop.` : "Buyers' questions about your products and orders. Quick replies win sales."} />
      <Tabs value={tab}>
        <TabsList className="grid h-auto w-full grid-cols-2 sm:inline-flex sm:w-auto">
          {(
            [
              ["chats", "Chats", d?.unread ?? 0],
              ["questions", "Questions", d?.unansweredQuestions ?? 0],
            ] as const
          ).map(([id, label, n]) => (
            <TabsTrigger key={id} value={id} asChild className="min-h-11 px-4">
              <Link to="/messages" search={{ tab: id === "chats" ? undefined : id }} replace>
                {label}
                {n ? <span className="ml-1.5 rounded-full bg-brand px-1.5 text-xs font-bold text-brand-foreground tabular">{n}</span> : null}
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {tab === "questions" ? <Questions /> : inbox.isPending ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : inbox.isError ? (
        <ErrorState title="Messages didn't load" error={inbox.error} onRetry={() => void inbox.refetch()} className="rounded-2xl border bg-card" />
      ) : !d?.items.length ? (
        <EmptyState illustration="no-messages" icon={Message01Icon} title="No messages yet" description="When a buyer asks about a product or an order, it shows here." className="rounded-2xl border bg-card" />
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {d.items.map((t) => (
            <li key={t.id}>
              <Link to="/messages/$id" params={{ id: t.id }} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-muted/50">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className={cn("truncate", t.unread ? "font-bold" : "font-semibold")}>
                      {t.buyerName}
                      <span className="font-normal text-muted-foreground"> · {t.orderReference ? `Order ${t.orderReference}` : (t.productTitle ?? "General")}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(t.lastMessageAt)}</span>
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {t.last ? `${t.last.sender === "seller" ? "You: " : ""}${t.last.body}` : ""}
                  </span>
                </span>
                {t.unread ? <span className="size-2.5 shrink-0 rounded-full bg-brand" aria-label="Unread" /> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Questions() {
  const q = useQuery({ queryKey: ["questions"], queryFn: listQuestions })
  if (q.isPending) return <Skeleton className="h-48 rounded-2xl" />
  if (q.isError) return <ErrorState title="Questions didn't load" error={q.error} onRetry={() => void q.refetch()} className="rounded-2xl border bg-card" />
  if (!q.data.items.length) return <EmptyState illustration="no-messages" icon={Message01Icon} title="No product questions yet" description="Answered questions show on your product pages for every buyer." className="rounded-2xl border bg-card" />
  return (
    <ul className="space-y-3">
      {q.data.items.map((x) => (
        <li key={x.id}>
          <QuestionCard q={x} />
        </li>
      ))}
    </ul>
  )
}

function QuestionCard({ q }: { q: SellerQuestion }) {
  const qc = useQueryClient()
  const [text, setText] = useState("")
  const m = useMutation({
    mutationFn: () => answerQuestion(q.id, text.trim()),
    onSuccess: () => {
      toast.success("Answered — it now shows on the product page.")
      void qc.invalidateQueries({ queryKey: ["questions"] })
      void qc.invalidateQueries({ queryKey: qk.messages })
    },
    onError: (e: unknown) => toast.error((e as Error).message || "Couldn't save the answer."),
  })
  return (
    <div className="space-y-2 rounded-2xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">
        {q.productTitle ?? "Product"} · {q.askerName} · {timeAgo(q.askedAt)}
        {q.hidden ? " · hidden by alkemart" : ""}
      </p>
      <p className="font-semibold [overflow-wrap:anywhere]">{q.question}</p>
      {q.answer ? (
        <p className="[overflow-wrap:anywhere]">
          <span className="font-semibold">Your answer:</span> {q.answer}
        </p>
      ) : (
        <div className="space-y-2">
          <label htmlFor={`ans-${q.id}`} className="sr-only">
            Your answer
          </label>
          <textarea
            id={`ans-${q.id}`}
            rows={2}
            maxLength={1000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Your answer — everyone can see it"
            className="w-full rounded-2xl border bg-input/30 px-3.5 py-2.5 text-[15px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <Button size="lg" variant="brand" disabled={text.trim().length < 2 || m.isPending} onClick={() => m.mutate()}>
            Answer
          </Button>
        </div>
      )}
    </div>
  )
}
