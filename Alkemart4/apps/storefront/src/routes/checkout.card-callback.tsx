import { useEffect, useRef, useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@workspace/ui"
import { pollMomoCheckoutStatus } from "@/lib/checkout"
import { PageSeo } from "@/components/page-seo"

export const Route = createFileRoute("/checkout/card-callback")({
  validateSearch: (s: Record<string, unknown>) => ({
    trxref: typeof s.trxref === "string" ? s.trxref : "",
    reference: typeof s.reference === "string" ? s.reference : "",
  }),
  component: CardCallbackPage,
})

function CardCallbackPage() {
  const navigate = useNavigate()
  const { trxref, reference } = Route.useSearch()
  const [failed, setFailed] = useState<string | null>(null)
  const cartId = useRef<string | null>(null)

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("alkemart.storefront.card_cart_id")
      if (stored) cartId.current = stored
    } catch {
      /* private mode */
    }
  }, [])

  const statusQ = useQuery({
    queryKey: ["store", "card-status", cartId.current],
    queryFn: () => pollMomoCheckoutStatus(cartId.current!),
    enabled: Boolean(cartId.current),
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
      try {
        sessionStorage.removeItem("alkemart.storefront.card_cart_id")
      } catch {
        /* private mode */
      }
      void navigate({
        to: "/order/$id",
        params: { id: d.order_id },
        search: {
          placed: "1",
          pay: "card",
        },
      })
    }
    if (d.status === "failed") {
      setFailed(
        "message" in d && d.message ? d.message : "Payment failed or abandoned",
      )
    }
  }, [statusQ.data, navigate])

  if (!cartId.current) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-12 text-center">
        <PageSeo title="Confirming payment" noindex path="/checkout/card-callback" />
        <p className="text-sm text-muted-foreground">
          Missing payment session. If you completed payment, check your orders.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild variant="outline">
            <Link to="/cart">Back to cart</Link>
          </Button>
          <Button asChild>
            <Link to="/orders">My orders</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 py-10">
      <PageSeo title="Confirming payment" noindex path="/checkout/card-callback" />
      <header className="space-y-2 text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Card payment
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Confirming your payment
        </h1>
        <p className="text-sm text-muted-foreground">
          {failed
            ? "Payment could not be processed."
            : "Please wait while we confirm your card payment."}
        </p>
      </header>

      <div className="space-y-3 rounded-3xl border border-border bg-card p-6 text-sm shadow-sm">
        {reference || trxref ? (
          <p className="text-muted-foreground">
            Reference ·{" "}
            <span className="font-medium text-foreground">
              {reference || trxref}
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
                  ? "Verifying…"
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
          <Link to="/orders">My orders</Link>
        </Button>
      </div>
    </div>
  )
}
