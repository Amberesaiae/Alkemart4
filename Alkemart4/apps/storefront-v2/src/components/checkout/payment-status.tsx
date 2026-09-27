import { useEffect, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { Alert02Icon, SmartPhone01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { BrandSpinner } from "@/components/brand/brand-logo"
import { trackOrderCompleted } from "@/lib/analytics"
import { pollMomoCheckoutStatus } from "@/lib/checkout"
import { cardCartId } from "@/lib/checkout-session"
import { qk } from "@/hooks/use-store"

const POLL_MS = 3000
/** After this, stop polling and hand the buyer a clear next step. */
const GIVE_UP_MS = 10 * 60_000

/**
 * Waits for a pending payment (MoMo prompt or card redirect) to settle,
 * then lands on the order. Never polls forever.
 */
export function PaymentStatus({
  cartId,
  method,
  reference,
}: {
  cartId: string | null
  method: "momo" | "card"
  reference?: string | null
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [started] = useState(() => Date.now())
  const [timedOut, setTimedOut] = useState(false)

  const q = useQuery({
    queryKey: ["store", "payment-status", cartId],
    queryFn: () => pollMomoCheckoutStatus(cartId!),
    enabled: Boolean(cartId) && !timedOut,
    refetchInterval: (query) => {
      const s = query.state.data?.status
      if (s === "completed" || s === "failed") return false
      if (Date.now() - started > GIVE_UP_MS) {
        setTimedOut(true)
        return false
      }
      return POLL_MS
    },
    retry: 2,
  })

  useEffect(() => {
    const d = q.data
    if (d?.status === "completed" && "order_id" in d) {
      // Online payments finish here, not in checkout — count them once per order.
      try {
        const key = `alkemart.completed_tracked.${d.order_id}`
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, "1")
          trackOrderCompleted({ paymentMethod: method })
        }
      } catch {
        trackOrderCompleted({ paymentMethod: method })
      }
      cardCartId.set(null)
      void queryClient.invalidateQueries({ queryKey: qk.cart })
      void navigate({ to: "/order/$id", params: { id: d.order_id }, search: { placed: "1", pay: method }, replace: true })
    }
  }, [q.data, method, navigate, queryClient])

  const failed = q.data?.status === "failed" ? ("message" in q.data && q.data.message) || "Payment failed" : null

  if (!cartId) {
    return (
      <Panel title="We lost track of this payment" icon={Alert02Icon}>
        <p className="text-muted-foreground">If money left your account, the order will show under your orders shortly.</p>
        <Actions />
      </Panel>
    )
  }
  if (failed) {
    return (
      <Panel title="Payment didn't go through" icon={Alert02Icon}>
        <p className="text-muted-foreground">{failed}. Your cart is still here, so you can try again or pick another way to pay.</p>
        <Actions retry />
      </Panel>
    )
  }
  if (timedOut) {
    return (
      <Panel title="Still waiting for confirmation" icon={Alert02Icon}>
        <p className="text-muted-foreground">
          {method === "momo"
            ? "We didn't hear back from your mobile money provider. If you approved the prompt, the order will appear under your orders. If not, try again."
            : "Your bank hasn't confirmed yet. If you completed payment, the order will appear under your orders."}
        </p>
        <Actions retry />
      </Panel>
    )
  }
  return (
    <Panel
      title={method === "momo" ? "Approve the prompt on your phone" : "Confirming your card payment"}
      icon={method === "momo" ? SmartPhone01Icon : undefined}
    >
      <p className="text-muted-foreground">
        {method === "momo"
          ? "Enter your mobile money PIN when the prompt appears. This page moves on by itself once it's confirmed."
          : "This takes a few seconds. Please don't close this page."}
      </p>
      <BrandSpinner className="my-2" />
      {reference ? <p className="text-xs text-muted-foreground">Reference {reference}</p> : null}
    </Panel>
  )
}

function Panel({ title, icon, children }: { title: string; icon?: typeof Alert02Icon; children: React.ReactNode }) {
  return (
    <div className="container-page grid min-h-[60vh] place-items-center py-12">
      <div className="w-full max-w-md space-y-4 rounded-[2rem] border border-border p-8 text-center">
        {icon ? (
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-brand">
            <HugeiconsIcon icon={icon} className="size-7" />
          </span>
        ) : null}
        <h1 className="text-2xl font-extrabold">{title}</h1>
        {children}
      </div>
    </div>
  )
}

function Actions({ retry }: { retry?: boolean }) {
  return (
    <div className="flex flex-wrap justify-center gap-2 pt-2">
      {retry ? (
        <Button asChild variant="brand" size="lg">
          <Link to="/checkout">Try again</Link>
        </Button>
      ) : null}
      <Button asChild variant="outline" size="lg">
        <Link to="/orders">My orders</Link>
      </Button>
      <Button asChild variant="ghost" size="lg">
        <Link to="/help">Get help</Link>
      </Button>
    </div>
  )
}
