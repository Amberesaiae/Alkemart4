import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { PageSeo } from "@/components/seo/page-seo"
import { Composer } from "@/components/messages/conversation"
import { listThreads, startThread } from "@/lib/messages"
import { requireAuth } from "@/lib/route-guards"

type Search = { sellerId: string; productId?: string; orderId?: string; shop?: string; about?: string }

/** First message to a shop, about a product or an order. Continues an existing thread when there is one. */
export const Route = createFileRoute("/messages/new")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    sellerId: typeof s.sellerId === "string" ? s.sellerId : "",
    ...(typeof s.productId === "string" ? { productId: s.productId } : {}),
    ...(typeof s.orderId === "string" ? { orderId: s.orderId } : {}),
    ...(typeof s.shop === "string" ? { shop: s.shop } : {}),
    ...(typeof s.about === "string" ? { about: s.about } : {}),
  }),
  beforeLoad: requireAuth,
  component: NewMessage,
})

function NewMessage() {
  const s = Route.useSearch()
  const navigate = useNavigate()
  const starters = useQuery({ queryKey: ["store", "messages"], queryFn: listThreads })
  const start = useMutation({
    mutationFn: (body: string) => startThread({ sellerId: s.sellerId, productId: s.productId, orderId: s.orderId, body }),
    onSuccess: (r) => void navigate({ to: "/messages/$id", params: { id: r.thread.id }, replace: true }),
    onError: (e: unknown) => toast.error((e as Error).message || "That didn't go through. Try again."),
  })
  return (
    <div className="container-page max-w-3xl space-y-4 pt-4 sm:pt-6">
      <PageSeo title="Message the shop" noindex />
      <Link to="/messages" className="inline-flex min-h-11 items-center text-sm font-semibold text-muted-foreground hover:text-foreground">
        ← Messages
      </Link>
      <header className="space-y-1">
        <h1 className="text-2xl font-extrabold">Message {s.shop ?? "the shop"}</h1>
        {s.about ? <p className="text-sm text-muted-foreground">About {s.about}</p> : null}
      </header>
      <section aria-label="New message" className="rounded-3xl border border-border p-4 sm:p-5">
        <Composer id="new-message" quickReplies={starters.data?.quickReplies ?? []} pending={start.isPending} onSend={(body) => start.mutateAsync(body)} />
      </section>
    </div>
  )
}
