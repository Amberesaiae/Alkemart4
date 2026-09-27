import { createFileRoute } from "@tanstack/react-router"
import { PaymentStatus } from "@/components/checkout/payment-status"
import { PageSeo } from "@/components/seo/page-seo"
import { maskOrderId } from "@/lib/orders"

export const Route = createFileRoute("/checkout/pending")({
  validateSearch: (s: Record<string, unknown>) => ({
    cart_id: typeof s.cart_id === "string" ? s.cart_id : "",
    ref: typeof s.ref === "string" ? s.ref : "",
  }),
  component: MomoPending,
})

function MomoPending() {
  const { cart_id, ref } = Route.useSearch()
  return (
    <>
      <PageSeo title="Waiting for payment" noindex />
      <PaymentStatus cartId={cart_id || null} method="momo" reference={ref ? maskOrderId(ref) : null} />
    </>
  )
}
