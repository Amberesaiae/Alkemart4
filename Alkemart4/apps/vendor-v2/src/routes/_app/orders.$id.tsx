import { useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert02Icon,
  ArrowLeft01Icon,
  Clock01Icon,
  Call02Icon,
  Copy01Icon,
  DeliveryTruck01Icon,
  Location01Icon,
  Share08Icon,
  Tick02Icon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@workspace/console-ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/console-ui/components/card"
import { Skeleton } from "@workspace/console-ui/components/skeleton"
import { Spinner } from "@workspace/console-ui/components/spinner"
import { StatusBadge } from "@workspace/console-ui/components/console/status-badge"
import { ErrorState } from "@workspace/console-ui/components/console/states"
import { formatMinor } from "@workspace/console-ui/lib/money"
import { cn } from "@workspace/console-ui/lib/utils"
import { orderReference } from "@alkemart/shared/order-ref"
import { mapsLink } from "@alkemart/maps"
import { markDelivered, markSent, type OrderDetail } from "@/lib/api"
import { qk, useOrder } from "@/lib/queries"
import { ReturnPanel } from "@/components/orders/return-actions"

export const Route = createFileRoute("/_app/orders/$id")({ component: OrderPage })

const STEPS = [
  { status: "placed", label: "To pack" },
  { status: "shipped", label: "On the way" },
  { status: "delivered", label: "Delivered" },
] as const

const PICKUP_STEPS = [
  { status: "placed", label: "To pack" },
  { status: "shipped", label: "Ready for pickup" },
  { status: "delivered", label: "Collected" },
] as const

function OrderPage() {
  const { id } = Route.useParams()
  const q = useOrder(id)
  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <Link to="/orders" className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-semibold text-muted-foreground hover:text-foreground">
        <HugeiconsIcon icon={ArrowLeft01Icon} className="size-5" aria-hidden />
        Orders
      </Link>
      {q.isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : q.isError ? (
        <ErrorState
          title={(q.error as { status?: number }).status === 404 ? "We couldn't find this order" : "This order didn't load"}
          error={(q.error as { status?: number }).status === 404 ? undefined : q.error}
          onRetry={(q.error as { status?: number }).status === 404 ? undefined : () => void q.refetch()}
          className="rounded-2xl border bg-card"
        />
      ) : (
        <OrderBody order={q.data} />
      )}
    </div>
  )
}

function OrderBody({ order }: { order: OrderDetail }) {
  const ref = orderReference(order.orderGroupId)
  const addr = order.shippingAddress
  const subtotal = Number(order.subtotalPesewas)
  const delivery = Number(order.deliveryFeePesewas)
  const cod = order.paymentMethod === "cod"
  const placed = order.placedAt
    ? new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(order.placedAt))
    : null

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-[1.75rem]">Order {ref}</h1>
          {placed ? <p className="mt-1 text-[15px] text-muted-foreground">Placed {placed}</p> : null}
        </div>
        <StatusBadge kind="order" status={order.status} audience="seller" className="h-8 px-3 text-sm" />
      </header>

      {order.returnCase ? <ReturnPanel order={order} rc={order.returnCase} /> : null}
      {order.problem ? (
        <section role="alert" className="flex gap-3 rounded-2xl border-2 border-warning bg-warning-soft p-4">
          <HugeiconsIcon icon={Alert02Icon} className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="space-y-1 text-[15px]">
            <p className="font-bold">The buyer reported a problem</p>
            <p>“{order.problem.note}”</p>
            <p className="text-foreground/80">Payment for this order is on hold until the buyer marks it sorted. Most problems end with a quick call, a swap or a refund.</p>
          </div>
        </section>
      ) : null}
      <Tracker order={order} />
      <Deadlines order={order} />
      <NextStep order={order} cod={cod} total={subtotal + delivery} />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What to pack</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {order.items.map((i) => (
                <li key={i.id} className="flex items-center gap-4 py-3 first:pt-0">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-lg font-extrabold text-brand-foreground tabular">
                    {i.qty}
                    <span className="sr-only">×</span>
                  </span>
                  <span className="min-w-0 flex-1 text-[15px] font-medium">{i.title}</span>
                  <span className="text-right text-sm text-muted-foreground tabular">
                    {formatMinor(Number(i.unitPricePesewas) * i.qty)}
                  </span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-1.5 border-t pt-4 text-[15px]">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Items</dt>
                <dd className="tabular">{formatMinor(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{order.fulfillmentMethod === "pickup" ? "Pickup" : "Delivery"}</dt>
                <dd className="tabular">{formatMinor(delivery)}</dd>
              </div>
              <div className="flex justify-between text-base font-bold">
                <dt>Buyer pays</dt>
                <dd className="tabular">{formatMinor(subtotal + delivery)}</dd>
              </div>
              {Number(order.refundedPesewas ?? 0) > 0 ? (
                <div className="flex justify-between font-semibold text-destructive">
                  <dt>Refunded to the buyer</dt>
                  <dd className="tabular">−{formatMinor(Number(order.refundedPesewas))}</dd>
                </div>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{order.fulfillmentMethod === "pickup" ? "Buyer is picking up" : "Deliver to"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {addr ? (
                <>
                  <div className="flex gap-3">
                    <HugeiconsIcon icon={Location01Icon} className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
                    <address className="text-[15px] not-italic">
                      <span className="block font-semibold">
                        {addr.first_name} {addr.last_name}
                      </span>
                      {order.fulfillmentMethod === "pickup" ? (
                        <span className="block text-muted-foreground">Collecting from your shop. They'll show a 4-digit code.</span>
                      ) : (
                        <>
                          {addr.address_1}
                          {addr.address_2 ? <span className="block">{addr.address_2}</span> : null}
                          <span className="block">{[addr.city, addr.province].filter(Boolean).join(", ")}</span>
                          {addr.postal_code ? <span className="block text-muted-foreground">{addr.postal_code}</span> : null}
                        </>
                      )}
                      {order.fulfillmentMethod !== "pickup" && addr.latitude != null && addr.longitude != null ? (
                        <a
                          href={mapsLink({ lat: addr.latitude, lng: addr.longitude })}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex min-h-8 items-center gap-1 text-sm font-semibold underline underline-offset-4"
                        >
                          Buyer pinned their spot · open in Maps<span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      ) : null}
                    </address>
                  </div>
                  {addr.phone ? (
                    <div className="grid grid-cols-2 gap-2">
                      <Button asChild variant="outline" size="lg">
                        <a href={`tel:${addr.phone.replace(/\s+/g, "")}`}>
                          <HugeiconsIcon icon={Call02Icon} data-icon="inline-start" /> Call buyer
                        </a>
                      </Button>
                      <ShareButton order={order} />
                    </div>
                  ) : (
                    <ShareButton order={order} />
                  )}
                </>
              ) : (
                <p className="text-[15px] text-muted-foreground">No delivery address was saved with this order. Contact support with the order number.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-3 text-[15px]">
              <HugeiconsIcon icon={Wallet01Icon} className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
              {cod ? (
                <p>
                  <span className="block font-semibold">Pay on delivery</span>
                  Collect <strong className="tabular">{formatMinor(subtotal + delivery)}</strong> {order.fulfillmentMethod === "pickup" ? "when they pick it up." : "when you hand it over."}
                </p>
              ) : (
                <p>
                  <span className="block font-semibold">{order.paymentMethod === "momo" ? "Paid by mobile money" : order.paymentMethod === "card" ? "Paid by card" : "Paid online"}</span>
                  Don't collect money from the buyer.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

const when = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso))
const dayOnly = (iso: string) => new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" }).format(new Date(iso))

/** The promise made to the buyer at checkout, and whether you're keeping it. */
function Deadlines({ order }: { order: OrderDetail }) {
  const p = order.promise
  if (!p || order.status === "delivered" || order.status === "cancelled") return null
  const eta = p.deliverLatest
    ? p.deliverEarliest && dayOnly(p.deliverEarliest) !== dayOnly(p.deliverLatest)
      ? `${dayOnly(p.deliverEarliest)} – ${dayOnly(p.deliverLatest)}`
      : dayOnly(p.deliverLatest)
    : null
  const late = p.state === "dispatch_late" || p.state === "delivery_late"
  return (
    <div role={late ? "alert" : undefined} className={cn("flex gap-3 rounded-2xl p-4 text-[15px]", late ? "bg-danger-soft text-destructive" : "bg-muted")}>
      <HugeiconsIcon icon={late ? Alert02Icon : Clock01Icon} className="mt-0.5 size-5 shrink-0" aria-hidden />
      <p className={late ? "" : "text-foreground"}>
        {p.state === "dispatch_late"
          ? `Late: you promised to send this by ${when(p.dispatchBy!)}. Send it now, or call the buyer.`
          : p.state === "delivery_late"
            ? `Late: the buyer expected it by ${eta}. Check with your rider and update the buyer.`
            : order.status === "placed" && p.dispatchBy && order.fulfillmentMethod === "pickup"
              ? <>Buyer is picking up · have it ready by <strong>{when(p.dispatchBy)}</strong></>
              : order.status === "placed" && p.dispatchBy
              ? <>Send by <strong>{when(p.dispatchBy)}</strong>{eta ? <> · Buyer expects it <strong>{eta}</strong></> : null}</>
              : eta
                ? <>Buyer expects it <strong>{eta}</strong></>
                : "No delivery date was promised on this order."}
      </p>
    </div>
  )
}

function Tracker({ order }: { order: OrderDetail }) {
  const status = order.status
  const doneAt = new Map((order.timeline ?? []).map((t) => [t.status, t.at]))
  const steps = order.fulfillmentMethod === "pickup" ? PICKUP_STEPS : STEPS
  const at = steps.findIndex((s) => s.status === status)
  if (status === "cancelled") {
    return <p className="rounded-2xl bg-muted p-4 font-semibold">This order was cancelled. There's nothing to send.</p>
  }
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Order progress">
      {steps.map((s, i) => {
        const done = i < at || status === "delivered"
        const current = i === at && status !== "delivered"
        return (
          <li key={s.status} aria-current={current ? "step" : undefined} className="space-y-2">
            <span className={cn("block h-1.5 rounded-full", i <= at ? "bg-foreground" : "bg-border")} />
            <span className={cn("flex items-center gap-1.5 text-sm font-semibold", i <= at ? "text-foreground" : "text-muted-foreground")}>
              {done ? <HugeiconsIcon icon={Tick02Icon} className="size-4 text-success" aria-hidden /> : null}
              {s.label}
              {done ? <span className="sr-only">(done)</span> : current ? <span className="sr-only">(now)</span> : null}
            </span>
            {doneAt.get(s.status === "placed" ? "placed" : s.status === "shipped" ? "shipped" : "delivered") && i <= at ? (
              <span className="block text-xs text-muted-foreground">{when(doneAt.get(s.status)!)}</span>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

/**
 * The one next action, inline (no pop-ups) and sticky on phones. Trust by
 * default: the seller can always mark delivered; the buyer's code is optional
 * proof that gets an online payout released at once.
 */
function NextStep({ order, cod, total }: { order: OrderDetail; cod: boolean; total: number }) {
  const qc = useQueryClient()
  const pickup = order.fulfillmentMethod === "pickup"
  const [mode, setMode] = useState<"idle" | "deliver">("idle")
  const [code, setCode] = useState("")
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: qk.orders })
    void qc.invalidateQueries({ queryKey: qk.tasks })
    void qc.invalidateQueries({ queryKey: qk.statement })
  }
  const onError = (err: unknown) => {
    const e = err as { status?: number; message?: string }
    toast.error(
      e.status == null
        ? "No connection — nothing changed. Try again when you're back online."
        : e.status === 409
          ? "This order already moved on. Refreshing it now."
          : (e.message ?? "Couldn't update the order. Please try again."),
    )
    if (e.status === 409) refresh()
  }
  const sent = useMutation({
    mutationFn: () => markSent(order.id),
    onSuccess: () => {
      toast.success(pickup ? "Marked ready — the buyer can come and collect." : "Marked as sent — the buyer can see it's on the way.")
      refresh()
    },
    onError,
  })
  const delivered = useMutation({
    mutationFn: () => markDelivered(order.id, code.replace(/\D/g, "") || undefined),
    onSuccess: () => {
      const word = pickup ? "Collected" : "Delivered"
      toast.success(code && !cod ? `${word} and confirmed by the buyer's code — payment is released.` : code ? `${word} and confirmed by the buyer's code.` : `${word}.`)
      setMode("idle")
      setCode("")
      refresh()
    },
    onError,
  })

  if (order.status === "cancelled") return null
  if (order.status === "delivered") return <DeliveredNote order={order} cod={cod} />

  if (mode === "deliver") {
    return (
      <section aria-labelledby="deliver-title" className="space-y-4 rounded-2xl border-2 border-foreground bg-card p-4 sm:p-5">
        <div>
          <h2 id="deliver-title" className="text-lg font-bold">
            {pickup ? "Has the buyer collected it?" : "Has the buyer received it?"}
          </h2>
          <p className="mt-1 text-[15px] text-muted-foreground">
            {cod ? `Collect ${formatMinor(total)} first. ` : ""}
            {order.handoverAvailable
              ? cod
                ? `Ask for their 4-digit code — it proves the handover if there's ever a question. No code? You can still mark it ${pickup ? "collected" : "delivered"}.`
                : `Ask for their 4-digit code — with it you're paid straight away. No code? You can still mark it ${pickup ? "collected" : "delivered"}.`
              : `Mark it ${pickup ? "collected" : "delivered"} once they have it.`}
          </p>
        </div>
        {order.handoverAvailable ? (
          <div className="space-y-1.5">
            <label htmlFor="handover-code" className="block text-sm font-medium">
              Buyer's code <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <input
              id="handover-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={5}
              placeholder="0000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
              className="h-12 w-36 rounded-2xl border bg-input/30 px-4 text-center text-2xl font-bold tracking-[0.3em] tabular outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button variant="brand" size="lg" disabled={delivered.isPending} onClick={() => delivered.mutate()}>
            {delivered.isPending ? <Spinner /> : <HugeiconsIcon icon={Tick02Icon} data-icon="inline-start" />}
            {code.replace(/\D/g, "").length === 4 ? "Confirm with code" : pickup ? "Mark collected" : "Mark delivered"}
          </Button>
          <Button variant="ghost" size="lg" disabled={delivered.isPending} onClick={() => setMode("idle")}>
            Not yet
          </Button>
        </div>
      </section>
    )
  }

  return (
    <div className="fixed inset-x-0 bottom-16 z-20 flex flex-wrap gap-2 border-t bg-background/95 p-3 pb-safe backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0">
      {order.status === "placed" ? (
        <>
          <Button variant="brand" size="xl" className="flex-1 lg:flex-none" disabled={sent.isPending} onClick={() => sent.mutate()}>
            {sent.isPending ? <Spinner /> : <HugeiconsIcon icon={DeliveryTruck01Icon} data-icon="inline-start" />}
            {pickup ? "Ready for pickup" : "Mark as sent"}
          </Button>
          <Button variant="outline" size="xl" className="flex-1 lg:flex-none" onClick={() => setMode("deliver")}>
            {pickup ? "Already collected" : "Already delivered"}
          </Button>
        </>
      ) : (
        <Button variant="brand" size="xl" className="w-full lg:w-auto" onClick={() => setMode("deliver")}>
          <HugeiconsIcon icon={Tick02Icon} data-icon="inline-start" />
          {pickup ? "Buyer collected it" : "Mark as delivered"}
        </Button>
      )}
    </div>
  )
}

function DeliveredNote({ order, cod }: { order: OrderDetail; cod: boolean }) {
  const byBuyer = order.deliveryConfirmedBy === "buyer" || order.deliveryConfirmedBy === "buyer_code"
  const waiting = !cod && !byBuyer && !!order.payoutReleaseAt
  return (
    <p className="flex items-start gap-2 rounded-2xl bg-success-soft p-4 font-semibold text-success">
      <HugeiconsIcon icon={Tick02Icon} className="mt-0.5 size-5 shrink-0" aria-hidden />
      <span>
        {(order.fulfillmentMethod === "pickup" ? "Collected" : "Delivered") + (byBuyer ? " — confirmed by the buyer. " : ". ")}
        {cod ? (
          "You collected the cash for this order."
        ) : order.payout?.status === "paid" ? (
          <>Paid out{order.payout.paidAt ? ` ${when(order.payout.paidAt)}` : ""}.</>
        ) : order.payout?.status === "pending" || order.payout?.status === "processing" ? (
          "Its payout is on its way to you."
        ) : waiting ? (
          <>Payment is released {when(order.payoutReleaseAt!)} unless the buyer reports a problem.</>
        ) : (
          <>
            It's in your next payout —{" "}
            <Link to="/money" className="underline underline-offset-4">
              see Money
            </Link>
          </>
        )}
      </span>
    </p>
  )
}

/** Plain-text order sheet for the rider — WhatsApp-friendly. */
function ShareButton({ order }: { order: OrderDetail }) {
  const a = order.shippingAddress
  const text = [
    `alkemart order ${orderReference(order.orderGroupId)}`,
    ...order.items.map((i) => `${i.qty} × ${i.title}`),
    a ? `Deliver to: ${a.first_name} ${a.last_name}, ${a.phone}` : null,
    a ? `${a.address_1}${a.address_2 ? `, ${a.address_2}` : ""}, ${[a.city, a.province].filter(Boolean).join(", ")}` : null,
    a?.latitude != null && a.longitude != null ? `Map: ${mapsLink({ lat: a.latitude, lng: a.longitude })}` : null,
    order.paymentMethod === "cod"
      ? `Collect: ${formatMinor(Number(order.subtotalPesewas) + Number(order.deliveryFeePesewas))}`
      : "Already paid — collect nothing",
  ]
    .filter(Boolean)
    .join("\n")
  const canShare = typeof navigator !== "undefined" && "share" in navigator
  return (
    <Button
      variant="outline"
      size="lg"
      onClick={async () => {
        try {
          if (canShare) await navigator.share({ text })
          else {
            await navigator.clipboard.writeText(text)
            toast.success("Order details copied — paste them to your rider.")
          }
        } catch {
          /* share sheet dismissed */
        }
      }}
    >
      <HugeiconsIcon icon={canShare ? Share08Icon : Copy01Icon} data-icon="inline-start" />
      {canShare ? "Share details" : "Copy details"}
    </Button>
  )
}
