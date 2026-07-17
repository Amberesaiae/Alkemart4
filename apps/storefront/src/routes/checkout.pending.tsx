/**
 * Lab MoMo pending screen — polls /store/ghana-checkout/status until complete/fail.
 * Not a production payment claim.
 */
import { useEffect, useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { pollMomoCheckoutStatus } from "@/lib/checkout"
import { PageSeo } from "@/components/page-seo"

export const Route = createFileRoute("/checkout/pending")({
  validateSearch: (s: Record<string, unknown>) => ({
    cart_id: typeof s.cart_id === "string" ? s.cart_id : "",
    ref: typeof s.ref === "string" ? s.ref : "",
  }),
  component: MomoPendingPage,
})

function MomoPendingPage() {
  const navigate = useNavigate()
  const { cart_id: cartId, ref } = Route.useSearch()
  const [failed, setFailed] = useState<string | null>(null)

  const statusQ = useQuery({
    queryKey: ["store", "momo-status", cartId],
    queryFn: () => pollMomoCheckoutStatus(cartId),
    enabled: Boolean(cartId),
    refetchInterval: (q) => {
      const d = q.state.data
      if (!d) return 3000
      if (d.status === "completed" || d.status === "failed") return false
      return 3000
    },
  })

  useEffect(() => {
    const d = statusQ.data
    if (!d) return
    if (d.status === "completed" && "order_id" in d && d.order_id) {
      void navigate({
        to: "/order/$id",
        params: { id: d.order_id },
        search: { placed: "1", pay: "momo" },
      })
    }
    if (d.status === "failed") {
      setFailed(
        "message" in d && d.message ? d.message : "Payment failed or abandoned",
      )
    }
  }, [statusQ.data, navigate])

  if (!cartId) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-12 text-center">
        <PageSeo title="Payment pending" noindex path="/checkout/pending" />
        <p className="text-sm text-muted-foreground">Missing cart reference.</p>
        <Button asChild>
          <Link to="/cart">Back to cart</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 py-10">
      <PageSeo title="MoMo pending (lab)" noindex path="/checkout/pending" />
      <header className="space-y-2 text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Lab · Mobile Money
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Confirm payment on your phone
        </h1>
        <p className="text-sm text-muted-foreground">
          Approve the USSD / MoMo prompt. This page polls the API — we do not
          invent a paid status.
        </p>
      </header>

      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-3 text-sm">
        {ref ? (
          <p>
            <span className="text-muted-foreground">Reference · </span>
            <span className="font-mono text-xs">{ref}</span>
          </p>
        ) : null}
        <p>
          <span className="text-muted-foreground">Cart · </span>
          <span className="font-mono text-xs">{cartId}</span>
        </p>
        <p className="text-muted-foreground">
          Status:{" "}
          <span className="font-semibold text-foreground">
            {failed
              ? "failed"
              : statusQ.data?.status ??
                (statusQ.isLoading ? "checking…" : "pending")}
          </span>
        </p>
        {statusQ.data &&
        statusQ.data.status === "payment_pending" &&
        "provider_status" in statusQ.data &&
        statusQ.data.provider_status ? (
          <p className="text-xs text-muted-foreground">
            Provider: {statusQ.data.provider_status}
          </p>
        ) : null}
      </div>

      {failed ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm"
        >
          <p className="font-semibold text-destructive">Payment not completed</p>
          <p className="text-muted-foreground">{failed}</p>
          <Button asChild className="mt-3" variant="outline">
            <Link to="/checkout">Try again</Link>
          </Button>
        </div>
      ) : (
        <p className="text-center text-xs text-muted-foreground animate-pulse">
          Waiting for Paystack confirmation…
        </p>
      )}

      <div className="flex justify-center gap-3">
        <Button asChild variant="outline">
          <Link to="/cart">Cart</Link>
        </Button>
        <Button type="button" variant="outline" onClick={() => void statusQ.refetch()}>
          Check now
        </Button>
      </div>
    </div>
  )
}
