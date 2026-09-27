import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { PaymentStatus } from "@/components/checkout/payment-status"
import { PageSeo } from "@/components/seo/page-seo"
import { cardCartId } from "@/lib/checkout-session"

/** Paystack returns here after card payment (`?reference=` / `?trxref=`). */
export const Route = createFileRoute("/checkout/card-callback")({
  validateSearch: (s: Record<string, unknown>) => ({
    reference: typeof s.reference === "string" ? s.reference : typeof s.trxref === "string" ? s.trxref : "",
  }),
  component: CardCallback,
})

function CardCallback() {
  const { reference } = Route.useSearch()
  // Read synchronously: the status query must be enabled on the first render.
  const [cartId] = useState(() => cardCartId.get())
  return (
    <>
      <PageSeo title="Confirming payment" noindex />
      <PaymentStatus cartId={cartId} method="card" reference={reference || null} />
    </>
  )
}
