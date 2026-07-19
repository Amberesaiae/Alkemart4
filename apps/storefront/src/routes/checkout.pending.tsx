/**
 * Mobile Money pending screen — polls checkout status until complete/fail.
 * Privacy: no email in URL; no raw cart_id dump in UI.
 */
import { useEffect, useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { pollMomoCheckoutStatus } from "@/lib/checkout"
import { PageSeo } from "@/components/page-seo"
import { maskOrderId } from "@/lib/orders"

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
        search: {
          placed: "1",
          pay: "momo",
        },
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
        <p className="text-sm text-muted-foreground">Missing payment session.</p>
        <Button asChild>
          <Link to="/cart">Back to cart</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 py-10">
      <PageSeo title="Payment pending" noindex path="/checkout/pending" />
      <header className="space-y-2 text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Mobile Money
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Confirm payment on your phone
        </h1>
        <p className="text-sm text-muted-foreground">
          Approve the MoMo prompt. This page updates when payment is confirmed.
        </p>
      </header>

      <div className="space-y-3 rounded-3xl border border-border bg-card p-6 text-sm shadow-sm">
        {ref ? (
          <p className="text-muted-foreground">
            Reference ·{" "}
            <span className="font-medium text-foreground">
              {maskOrderId(ref)}
            </span>
          </p>
        ) : null}
        <p className="text-muted-foreground">
          Status:{" "}
          <span className="font-semibold text-foreground">
            {failed
              ? "Failed"
              : statusQ.data?.status === "completed"
                ? "Confirmed"
                : statusQ.isFetching
                  ? "Waiting…"
                  : "Pending"}
          </span>
        </p>
        {failed ? (
          <p className="text-sm text-destructive" role="alert">
            {failed}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild variant="outline">
          <Link to="/cart">Back to cart</Link>
        </Button>
        <Button asChild>
          <Link to="/help">Help</Link>
        </Button>
      </div>
    </div>
  )
}
