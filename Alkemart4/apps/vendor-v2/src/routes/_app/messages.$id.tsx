import { useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@workspace/console-ui/components/button"
import { Skeleton } from "@workspace/console-ui/components/skeleton"
import { ChatComposer, ChatMessages } from "@workspace/console-ui/components/console/chat"
import { ErrorState } from "@workspace/console-ui/components/console/states"
import { getThread, sendMessage, threadAction } from "@/lib/api"
import { qk } from "@/lib/queries"

export const Route = createFileRoute("/_app/messages/$id")({ component: ThreadPage })

function ThreadPage() {
  const { id } = Route.useParams()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ["messages", id], queryFn: () => getThread(id), refetchInterval: 15_000 })
  const [reporting, setReporting] = useState(false)
  const [reason, setReason] = useState("")
  const refresh = () => void qc.invalidateQueries({ queryKey: qk.messages })
  const fail = (e: unknown) => toast.error((e as Error).message || "That didn't go through. Try again.")
  const send = useMutation({ mutationFn: (body: string) => sendMessage(id, body), onSuccess: refresh, onError: fail })
  const act = useMutation({
    mutationFn: (a: "block" | "unblock" | "report") => threadAction(id, a, a === "report" ? reason.trim() : undefined),
    onSuccess: (_d, a) => {
      toast.success(a === "report" ? "Reported — alkemart will look at it." : a === "block" ? "Blocked." : "Unblocked.")
      setReporting(false)
      refresh()
    },
    onError: fail,
  })
  const t = q.data?.thread
  return (
    <div className="space-y-5 pb-24 lg:pb-0">
      <Link to="/messages" className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-semibold text-muted-foreground hover:text-foreground">
        <HugeiconsIcon icon={ArrowLeft01Icon} className="size-5" aria-hidden />
        Messages
      </Link>
      {q.isPending ? (
        <Skeleton className="h-80 rounded-2xl" />
      ) : q.isError ? (
        <ErrorState title="This conversation didn't load" error={q.error} onRetry={() => void q.refetch()} className="rounded-2xl border bg-card" />
      ) : (
        <>
          <header>
            <h1 className="text-2xl font-extrabold tracking-tight">{t?.buyerName}</h1>
            <p className="text-[15px] text-muted-foreground">
              {t?.orderId ? (
                <Link to="/orders/$id" params={{ id: t.orderId }} className="font-semibold underline underline-offset-4">
                  About order {t.orderReference}
                </Link>
              ) : (
                `About ${t?.productTitle ?? "your shop"}`
              )}
            </p>
          </header>
          <section aria-label="Conversation" className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
            <ChatMessages messages={q.data.messages} me="seller" />
            <ChatComposer
              id={`reply-${id}`}
              quickReplies={q.data.quickReplies}
              pending={send.isPending}
              disabledReason={t?.blocked ? (t.blockedByYou ? "You blocked this buyer." : "This conversation is closed.") : null}
              onSend={(body) => send.mutateAsync(body)}
            />
          </section>
          {reporting ? (
            <div className="space-y-2 rounded-2xl border bg-card p-4">
              <label htmlFor="report-reason" className="block font-semibold">
                What went wrong?
              </label>
              <textarea
                id="report-reason"
                rows={2}
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Abusive messages, or asking to pay outside the app."
                className="w-full rounded-2xl border bg-input/30 px-3.5 py-2.5 text-[15px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
              <p className="text-sm text-muted-foreground">alkemart reads a conversation only when it's reported.</p>
              <div className="flex gap-2">
                <Button size="lg" disabled={reason.trim().length < 3 || act.isPending} onClick={() => act.mutate("report")}>
                  Report
                </Button>
                <Button size="lg" variant="ghost" onClick={() => setReporting(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {t?.reported ? (
                <span className="inline-flex min-h-10 items-center text-sm text-muted-foreground">Reported — alkemart will look at it.</span>
              ) : (
                <Button variant="outline" onClick={() => setReporting(true)}>
                  Report
                </Button>
              )}
              {t?.blockedByYou ? (
                <Button variant="ghost" disabled={act.isPending} onClick={() => act.mutate("unblock")}>
                  Unblock
                </Button>
              ) : !t?.blocked ? (
                <Button variant="ghost" disabled={act.isPending} onClick={() => act.mutate("block")}>
                  Block this buyer
                </Button>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  )
}
