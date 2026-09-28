import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Skeleton } from "@/components/ui/skeleton"
import { SellerAvatar } from "@/components/commerce/seller-avatar"
import { EmptyState, ErrorState } from "@/components/feedback/states"
import { PageSeo } from "@/components/seo/page-seo"
import { listThreads } from "@/lib/messages"
import { requireAuth } from "@/lib/route-guards"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/messages/")({ beforeLoad: requireAuth, component: Inbox })

const ago = (iso: string) => new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso))

function Inbox() {
  const q = useQuery({ queryKey: ["store", "messages"], queryFn: listThreads, refetchInterval: 30_000 })
  return (
    <div className="container-page max-w-3xl space-y-5 pt-4 sm:pt-6">
      <PageSeo title="Messages" noindex />
      <h1 className="text-3xl font-extrabold tracking-tight">Messages</h1>
      {q.isPending ? (
        <Skeleton className="h-48 rounded-3xl" />
      ) : q.isError ? (
        <ErrorState title="Messages didn't load" error={q.error} onRetry={() => void q.refetch()} />
      ) : q.data.items.length === 0 ? (
        <EmptyState illustration="no-messages" title="No conversations yet" description="Ask a shop about a product from its page, or about an order from the order page." />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-3xl border border-border">
          {q.data.items.map((t) => (
            <li key={t.id}>
              <Link to="/messages/$id" params={{ id: t.id }} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-muted/60 sm:px-5">
                <SellerAvatar name={t.sellerName ?? "Shop"} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className={cn("truncate", t.unread ? "font-bold" : "font-semibold")}>{t.sellerName ?? "Shop"}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{ago(t.lastMessageAt)}</span>
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {t.orderReference ? `Order ${t.orderReference} · ` : t.productTitle ? `${t.productTitle} · ` : ""}
                    {t.last ? `${t.last.sender === "buyer" ? "You: " : ""}${t.last.body}` : ""}
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
