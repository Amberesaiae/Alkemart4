import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorState } from "@/components/feedback/states"
import { PageSeo } from "@/components/seo/page-seo"
import { Composer, MessageList } from "@/components/messages/conversation"
import { getThread, sendMessage, threadAction } from "@/lib/messages"
import { requireAuth } from "@/lib/route-guards"

export const Route = createFileRoute("/messages/$id")({ beforeLoad: requireAuth, component: ThreadPage })

function ThreadPage() {
  const { id } = Route.useParams()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ["store", "messages", id], queryFn: () => getThread(id), refetchInterval: 15_000 })
  const [reporting, setReporting] = useState(false)
  const [reason, setReason] = useState("")
  const refresh = () => void qc.invalidateQueries({ queryKey: ["store", "messages"] })
  const fail = (e: unknown) => toast.error((e as Error).message || "That didn't go through. Try again.")
  const send = useMutation({ mutationFn: (body: string) => sendMessage(id, body), onSuccess: refresh, onError: fail })
  const act = useMutation({
    mutationFn: (a: "block" | "unblock" | "report") => threadAction(id, a, a === "report" ? reason.trim() : undefined),
    onSuccess: (_d, a) => {
      toast.success(a === "report" ? "Thanks — alkemart will look at this conversation." : a === "block" ? "Blocked. They can't message you here." : "Unblocked.")
      setReporting(false)
      refresh()
    },
    onError: fail,
  })
  const t = q.data?.thread
  return (
    <div className="container-page max-w-3xl space-y-4 pt-4 sm:pt-6">
      <PageSeo title="Conversation" noindex />
      <Link to="/messages" className="inline-flex min-h-11 items-center text-sm font-semibold text-muted-foreground hover:text-foreground">
        ← Messages
      </Link>
      {q.isPending ? (
        <Skeleton className="h-80 rounded-3xl" />
      ) : q.isError ? (
        <ErrorState title="This conversation didn't load" error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <>
          <header className="space-y-1">
            <h1 className="text-2xl font-extrabold">{t?.sellerName ?? "Shop"}</h1>
            <p className="text-sm text-muted-foreground">
              {t?.orderId ? (
                <Link to="/order/$id" params={{ id: t.orderId }} className="font-semibold underline underline-offset-4">
                  About order {t.orderReference}
                </Link>
              ) : t?.productId ? (
                <Link to="/product/$id" params={{ id: t.productId }} className="font-semibold underline underline-offset-4">
                  About {t.productTitle ?? "a product"}
                </Link>
              ) : (
                "General question"
              )}
            </p>
          </header>
          <section aria-label="Conversation" className="space-y-4 rounded-3xl border border-border p-4 sm:p-5">
            <MessageList messages={q.data.messages} me="buyer" />
            <Composer
              id={`reply-${id}`}
              quickReplies={q.data.quickReplies}
              pending={send.isPending}
              disabledReason={t?.blocked ? (t.blockedByYou ? "You blocked this shop." : "This conversation is closed.") : null}
              onSend={(body) => send.mutateAsync(body)}
            />
          </section>
          <div className="space-y-3 text-sm">
            {reporting ? (
              <div className="space-y-2 rounded-2xl border border-border p-4">
                <Label htmlFor="report-reason">What went wrong?</Label>
                <textarea
                  id="report-reason"
                  rows={2}
                  maxLength={300}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. They asked me to pay by MoMo outside the app."
                  className="w-full rounded-2xl border border-input bg-background px-3.5 py-2.5 text-[15px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
                <p className="text-muted-foreground">alkemart reads a conversation only when it's reported.</p>
                <div className="flex gap-2">
                  <Button size="sm" disabled={reason.trim().length < 3 || act.isPending} onClick={() => act.mutate("report")}>
                    Report
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setReporting(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {t?.reported ? <span className="inline-flex min-h-9 items-center text-muted-foreground">Reported — alkemart will look at it.</span> : (
                  <Button size="sm" variant="outline" onClick={() => setReporting(true)}>
                    Report
                  </Button>
                )}
                {t?.blockedByYou ? (
                  <Button size="sm" variant="ghost" disabled={act.isPending} onClick={() => act.mutate("unblock")}>
                    Unblock
                  </Button>
                ) : !t?.blocked ? (
                  <Button size="sm" variant="ghost" disabled={act.isPending} onClick={() => act.mutate("block")}>
                    Block this shop
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
