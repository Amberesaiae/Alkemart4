import { useEffect, useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert02Icon,
  Calendar03Icon,
  CheckmarkCircle02Icon,
  Copy01Icon,
  DeliveryBox01Icon,
  DeliveryTruck01Icon,
  Location01Icon,
  SecurityCheckIcon,
  ShoppingBag01Icon,
  Store04Icon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { SellerAvatar } from "@/components/commerce/seller-avatar"
import { ErrorState } from "@/components/feedback/states"
import { ReviewDialog } from "@/components/checkout/review-dialog"
import { PageSeo } from "@/components/seo/page-seo"
import { useSession } from "@/hooks/use-store"
import { lookupEmail } from "@/lib/checkout-session"
import { formatMoney } from "@/lib/market"
import { confirmReceived, formatAddressLines, getOrder, maskOrderId, problemSorted, type SellerOrder, type StoreOrder } from "@/lib/orders"
import { ProblemForm, ReturnStatus } from "@/components/orders/return-panel"
import { BuyerProtection } from "@/components/commerce/buyer-protection"
import { mapsLink } from "@alkemart/maps"
import { rememberOrderId } from "@/lib/recent-orders"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/order/$id")({
  validateSearch: (s: Record<string, unknown>): { placed?: string; pay?: string } => ({
    ...(typeof s.placed === "string" ? { placed: s.placed } : {}),
    ...(typeof s.pay === "string" ? { pay: s.pay } : {}),
  }),
  component: OrderPage,
})

const PAY_LABEL: Record<string, string> = { cod: "Pay on delivery", momo: "Mobile money", card: "Card" }

const day = (iso: string) => new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" }).format(new Date(iso))
const dayTime = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso))

/** "Sat 27 Sep" or "Sat 27 – Mon 29 Sep". */
function windowLabel(from: string | null, to: string | null) {
  if (!to) return null
  if (!from || day(from) === day(to)) return day(to)
  return `${day(from)} – ${day(to)}`
}

/** Headline + one supporting line for a shipment, in the buyer's words. */
function headline(so: SellerOrder): { title: string; line: string | null; tone: "live" | "done" | "late" | "off" } {
  const p = so.promise
  const eta = windowLabel(p?.deliverEarliest ?? null, p?.deliverLatest ?? null)
  const deliveredAt = so.timeline.find((t) => t.status === "delivered")?.at
  const sentAt = so.timeline.find((t) => t.status === "shipped")?.at
  if (so.fulfillmentMethod === "pickup") {
    switch (so.status) {
      case "delivered":
        return { title: "Collected", line: deliveredAt ? `On ${dayTime(deliveredAt)}` : null, tone: "done" }
      case "cancelled":
        return { title: "Cancelled", line: "Nothing to collect for this part of your order.", tone: "off" }
      case "shipped":
        return { title: "Ready for pickup", line: sentAt ? `Since ${dayTime(sentAt)}` : null, tone: "live" }
      default:
        return { title: "Being prepared", line: p?.dispatchBy ? `Ready by ${dayTime(p.dispatchBy)}` : "The seller will mark it ready.", tone: "live" }
    }
  }
  switch (so.status) {
    case "delivered":
      return { title: "Delivered", line: deliveredAt ? `On ${dayTime(deliveredAt)}` : null, tone: "done" }
    case "cancelled":
      return { title: "Cancelled", line: "Nothing will be delivered for this part of your order.", tone: "off" }
    case "shipped":
      return p?.state === "delivery_late"
        ? { title: "On the way — running late", line: eta ? `It was due ${eta}. If it doesn't arrive soon, contact support.` : null, tone: "late" }
        : { title: "On the way", line: eta ? `Arrives ${eta}` : sentAt ? `Sent ${dayTime(sentAt)}` : null, tone: "live" }
    default:
      return p?.state === "dispatch_late"
        ? { title: "Being packed — running late", line: "The seller hasn't sent it yet. If it isn't moving soon, contact support.", tone: "late" }
        : {
            title: "Being packed",
            line: eta ? `Arrives ${eta}` : p?.dispatchBy ? `The seller sends it by ${dayTime(p.dispatchBy)}` : null,
            tone: "live",
          }
  }
}

function LiveDot({ tone }: { tone: "live" | "done" | "late" | "off" }) {
  if (tone === "done") return <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-6 shrink-0 text-success" aria-hidden />
  if (tone === "off") return <span className="size-3 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
  return (
    <span className="relative flex size-3 shrink-0" aria-hidden>
      <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-60", tone === "late" ? "bg-deal" : "bg-success")} />
      <span className={cn("relative inline-flex size-3 rounded-full", tone === "late" ? "bg-deal" : "bg-success")} />
    </span>
  )
}

const STEP_COPY = {
  placed: { label: "Order placed", icon: ShoppingBag01Icon },
  shipped: { label: "Sent by the seller", icon: DeliveryTruck01Icon },
  delivered: { label: "Delivered", icon: DeliveryBox01Icon },
} as const

const PICKUP_STEP_COPY = {
  placed: STEP_COPY.placed,
  shipped: { label: "Ready for pickup", icon: Store04Icon },
  delivered: { label: "Collected", icon: DeliveryBox01Icon },
} as const

/** Vertical, dated timeline. Future steps show their expected date, greyed. */
function Timeline({ so }: { so: SellerOrder }) {
  if (so.status === "cancelled") return null
  const done = new Map(so.timeline.map((t) => [t.status, t.at]))
  const steps = (["placed", "shipped", "delivered"] as const).map((s) => {
    const at = done.get(s) ?? null
    const expected =
      !at && s === "shipped" ? (so.promise?.dispatchBy ?? null) : !at && s === "delivered" ? (so.promise?.deliverLatest ?? null) : null
    return { s, at, expected }
  })
  const current = steps.findIndex((x) => !x.at)
  const copy = so.fulfillmentMethod === "pickup" ? PICKUP_STEP_COPY : STEP_COPY
  return (
    <ol className="relative space-y-5" aria-label="Order progress">
      {steps.map((x, i) => {
        const reached = Boolean(x.at) || (i === 0 && !so.timeline.length)
        const isNext = i === current
        return (
          <li key={x.s} className="relative flex gap-3.5" aria-current={isNext ? "step" : undefined}>
            {i < steps.length - 1 ? (
              <span aria-hidden className={cn("absolute top-9 left-[17px] h-[calc(100%-12px)] w-0.5", steps[i + 1]?.at ? "bg-foreground" : "bg-border")} />
            ) : null}
            <span
              className={cn(
                "relative z-10 grid size-9 shrink-0 place-items-center rounded-full",
                reached ? "bg-foreground text-background" : isNext ? "border-2 border-foreground bg-background" : "border border-border bg-background text-muted-foreground",
              )}
            >
              <HugeiconsIcon icon={copy[x.s].icon} className="size-[18px]" aria-hidden />
            </span>
            <div className="min-w-0 pt-1">
              <p className={cn("text-[15px] font-semibold", !reached && "text-muted-foreground")}>
                {copy[x.s].label}
                <span className="sr-only">{reached ? " — done" : isNext ? " — next" : ""}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {x.at ? dayTime(x.at) : x.expected ? `Expected by ${x.s === "delivered" ? day(x.expected) : dayTime(x.expected)}` : isNext ? "Waiting" : ""}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * The buyer's side of the handover: their code (for the rider, or at pickup),
 * "I got it", and "There's a problem". All inline — no pop-ups.
 */
function Handover({ so, who, currency }: { so: SellerOrder; who: string; currency: string }) {
  const qc = useQueryClient()
  const [reporting, setReporting] = useState(false)
  const pickup = so.fulfillmentMethod === "pickup"
  const done = () => void qc.invalidateQueries({ queryKey: ["store", "order"] })
  const fail = (e: unknown) => toast.error((e as Error).message || "That didn't go through. Try again.")
  const received = useMutation({ mutationFn: () => confirmReceived(so.id, who), onSuccess: () => (toast.success("Thanks! The seller's been told."), done()), onError: fail })
  const sorted = useMutation({ mutationFn: () => problemSorted(so.id, who), onSuccess: () => (toast.success("Glad it's sorted."), done()), onError: fail })
  const rc = so.returnCase
  const caseOpen = !!rc && rc.status !== "closed"
  // A cancelled order still shows how its refund went.
  if (so.status === "cancelled") return rc ? <div className="border-t border-border p-4 sm:p-5"><ReturnStatus so={so} rc={rc} who={who} currency={currency} /></div> : null
  const delivered = so.status === "delivered"
  const canConfirm = !caseOpen && (!delivered || so.deliveryConfirmedBy === "seller")
  const canReport = (so.status === "shipped" || delivered) && !so.problemReported && !caseOpen

  return (
    <div className="space-y-3 border-t border-border p-4 sm:p-5">
      {so.handoverCode ? (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-brand/15 p-4">
          <div>
            <p className="text-sm font-semibold">{pickup ? "Your pickup code" : "Your handover code"}</p>
            <p className="text-3xl font-extrabold tracking-[0.25em] tabular" aria-label={`Code ${so.handoverCode.split("").join(" ")}`}>
              {so.handoverCode}
            </p>
          </div>
          <p className="min-w-0 flex-1 text-sm">
            {pickup
              ? "Show it when you collect. It confirms you got your order."
              : "Give it to the rider once you have your items — not before. It confirms delivery and pays the seller."}
          </p>
        </div>
      ) : null}
      {pickup && so.pickup && !delivered ? (
        <p className="text-sm">
          <span className="font-semibold">Pick up at:</span> {[so.pickup.landmark, so.pickup.place].filter(Boolean).join(" · ") || "the shop"}
          {so.pickup.lat != null && so.pickup.lng != null ? (
            <>
              {" "}
              <a href={mapsLink({ lat: so.pickup.lat, lng: so.pickup.lng })} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-4">
                Directions<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </>
          ) : null}
        </p>
      ) : null}

      {rc ? <ReturnStatus so={so} rc={rc} who={who} currency={currency} /> : null}

      {so.problemReported ? (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-warning bg-warning/10 p-3.5 text-sm">
          <span className="min-w-0 flex-1">You reported a problem. The seller has been told, and their payment for this order waits until it's sorted.</span>
          <Button size="sm" variant="outline" disabled={sorted.isPending} onClick={() => sorted.mutate()}>
            It's sorted
          </Button>
        </div>
      ) : reporting ? (
        <ProblemForm so={so} who={who} currency={currency} onClose={() => setReporting(false)} />
      ) : canConfirm || canReport ? (
        <div className="flex flex-wrap gap-2">
          {canConfirm ? (
            <Button size="sm" disabled={received.isPending} onClick={() => received.mutate()}>
              {pickup ? "I collected it" : "I got my order"}
            </Button>
          ) : null}
          {canReport ? (
            <Button size="sm" variant="outline" onClick={() => setReporting(true)}>
              There's a problem
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function Shipment({ so, order, index, count, who }: { so: SellerOrder; order: StoreOrder; index: number; count: number; who: string }) {
  const h = headline(so)
  return (
    <section aria-labelledby={`ship-${so.id}`} className="overflow-hidden rounded-3xl border border-border bg-background">
      <header className="space-y-3 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span className="flex min-w-0 items-center gap-2">
            <SellerAvatar name={so.seller?.name ?? "Seller"} size="sm" />
            <span className="truncate">
              {count > 1 ? `Package ${index + 1} of ${count} · ` : ""}
              {so.seller?.handle ? (
                <Link to="/shops/$slug" params={{ slug: so.seller.handle }} className="font-semibold text-foreground hover:underline">
                  {so.seller.name}
                </Link>
              ) : (
                <span className="font-semibold text-foreground">{so.seller?.name ?? "Seller"}</span>
              )}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {so.seller?.id ? (
              <Link
                to="/messages/new"
                search={{ sellerId: so.seller.id, orderId: so.id, shop: so.seller.name ?? undefined, about: `order ${maskOrderId(order.id)}` }}
                className="inline-flex min-h-9 items-center rounded-full px-2 font-semibold text-foreground underline underline-offset-4"
              >
                Message
              </Link>
            ) : null}
            {so.status === "delivered" && who ? <ReviewDialog orderId={so.id} email={who} sellerName={so.seller?.name ?? "this seller"} /> : null}
          </span>
        </div>
        <div className="flex items-center gap-3" role="status">
          <LiveDot tone={h.tone} />
          <div className="min-w-0">
            <h2 id={`ship-${so.id}`} className={cn("text-xl font-extrabold", h.tone === "late" && "text-deal")}>
              {h.title}
            </h2>
            {h.line ? <p className="text-[15px] text-muted-foreground">{h.line}</p> : null}
          </div>
        </div>
      </header>
      <Handover so={so} who={who} currency={order.currencyCode} />
      <div className="grid gap-5 border-t border-border p-4 sm:grid-cols-[1fr_1.1fr] sm:p-5">
        <Timeline so={so} />
        <ul className="space-y-2.5 sm:border-l sm:border-border sm:pl-5">
          {so.items.map((it) => (
            <li key={it.id} className="flex items-start justify-between gap-3 text-[15px]">
              <span className="min-w-0">
                {it.productId ? (
                  <Link to="/product/$id" params={{ id: it.productId }} className="line-clamp-2 font-medium hover:underline">
                    {it.title}
                  </Link>
                ) : (
                  <span className="line-clamp-2 font-medium">{it.title}</span>
                )}
                <span className="text-sm text-muted-foreground">Qty {it.quantity}</span>
              </span>
              <span className="shrink-0 tabular">{formatMoney(it.unitPrice != null ? it.unitPrice * it.quantity : null, order.currencyCode)}</span>
            </li>
          ))}
          <li className="flex justify-between border-t border-border pt-2.5 text-sm text-muted-foreground">
            <span>{so.fulfillmentMethod === "pickup" ? "Pickup" : "Delivery"}</span>
            <span className="tabular">{so.deliveryFee ? formatMoney(so.deliveryFee, order.currencyCode) : "Free"}</span>
          </li>
          {so.refunded > 0 ? (
            <li className="flex justify-between text-sm font-semibold text-success">
              <span>Refunded</span>
              <span className="tabular">−{formatMoney(so.refunded, order.currencyCode)}</span>
            </li>
          ) : null}
        </ul>
      </div>
    </section>
  )
}

function OrderPage() {
  const { id } = Route.useParams()
  const { placed, pay } = Route.useSearch()
  const session = useSession()
  const [email, setEmail] = useState(() => lookupEmail.get() ?? "")
  const [submitted, setSubmitted] = useState(() => lookupEmail.get() ?? "")
  const who = submitted || session.data?.email || ""

  const q = useQuery({
    queryKey: ["store", "order", id, who],
    queryFn: () => getOrder(id, { email: who || undefined }),
    enabled: Boolean(who) || Boolean(session.data),
    retry: false,
    // Live while anything is still moving; stops once every package is done.
    refetchInterval: (query) => {
      const o = query.state.data
      return o && o.sellerOrders.some((s) => s.status === "placed" || s.status === "shipped") ? 60_000 : false
    },
  })
  const order = q.data
  useEffect(() => {
    if (order?.id) rememberOrderId(order.id)
  }, [order?.id])

  const justPlaced = placed === "1"
  const needsEmail = !who && !session.isLoading && !session.data
  const cod = order?.paymentMethod === "cod"
  const allPickup = !!order?.sellerOrders.length && order.sellerOrders.every((o) => o.fulfillmentMethod === "pickup")

  return (
    <div className="container-page max-w-5xl space-y-5 pt-4 sm:space-y-6 sm:pt-6">
      <PageSeo title={order ? `Order ${maskOrderId(order.id)}` : "Your order"} noindex />

      {justPlaced ? (
        <section className="flex items-start gap-4 rounded-3xl bg-brand p-5 sm:items-center sm:p-7" aria-live="polite">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-background sm:size-14">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-7 text-success sm:size-8" />
          </span>
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-extrabold sm:text-3xl">Your order is in!</h1>
            <p className="font-medium text-foreground/80">
              {pay === "cod"
                ? allPickup
                  ? "Pay when you collect — check your items first."
                  : "Pay when it arrives — check your items with the rider first."
                : "Payment confirmed. Each seller is now preparing their part."}
            </p>
          </div>
        </section>
      ) : (
        <div>
          <Link to="/orders" className="inline-flex min-h-11 items-center text-sm font-semibold text-muted-foreground hover:text-foreground">
            ← Your orders
          </Link>
          <h1 className="text-2xl font-extrabold sm:text-3xl">{order ? `Order ${maskOrderId(order.id)}` : "Your order"}</h1>
        </div>
      )}

      {needsEmail || (q.isError && !session.data) ? (
        <form
          className="space-y-3 rounded-3xl border border-border p-5 sm:p-6"
          onSubmit={(e) => {
            e.preventDefault()
            lookupEmail.set(email.trim())
            setSubmitted(email.trim())
          }}
        >
          <p className="font-semibold">Confirm it's your order</p>
          <p className="text-sm text-muted-foreground">Enter the email you used at checkout.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Label htmlFor="lookup-email" className="sr-only">
              Email
            </Label>
            <Input id="lookup-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="h-11" />
            <Button type="submit" size="lg">
              View order
            </Button>
          </div>
          {q.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {q.error instanceof Error ? q.error.message : "Order not found"}
            </p>
          ) : null}
        </form>
      ) : null}

      {q.isLoading ? <Skeleton className="h-80 rounded-3xl" /> : null}
      {q.isError && session.data ? <ErrorState title="This order didn't load" error={q.error} onRetry={() => void q.refetch()} /> : null}

      {order ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px] lg:gap-6">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <HugeiconsIcon icon={Calendar03Icon} className="size-4" aria-hidden />
                {order.createdAt ? `Placed ${dayTime(order.createdAt)}` : null}
              </span>
              <button
                type="button"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-2 font-semibold text-foreground hover:bg-muted"
                onClick={async () => {
                  await navigator.clipboard.writeText(maskOrderId(order.id))
                  toast("Order number copied")
                }}
              >
                <HugeiconsIcon icon={Copy01Icon} className="size-4" aria-hidden />
                Copy order number
              </button>
              {q.isFetching && !q.isLoading ? <span aria-live="polite">Updating…</span> : null}
            </div>
            {order.sellerOrders.map((so, i) => (
              <Shipment key={so.id} so={so} order={order} index={i} count={order.sellerOrders.length} who={who} />
            ))}
          </div>

          <aside className="space-y-4">
            <div className="space-y-2 rounded-3xl border border-border p-4 text-[15px] sm:p-5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Items</span>
                <span className="tabular">{formatMoney(order.itemTotal, order.currencyCode)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{allPickup ? "Pickup" : "Delivery"}</span>
                <span className="tabular">{order.shippingTotal ? formatMoney(order.shippingTotal, order.currencyCode) : "Free"}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-bold">
                <span>Total</span>
                <span className="tabular">{formatMoney(order.total, order.currencyCode)}</span>
              </div>
            </div>

            <div className="flex gap-3 rounded-3xl border border-border p-4 text-[15px] sm:p-5">
              <HugeiconsIcon icon={Wallet01Icon} className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <p className="font-semibold">{PAY_LABEL[order.paymentMethod ?? ""] ?? "Payment"}</p>
                <p className="text-muted-foreground">
                  {order.paymentState === "collect_on_delivery"
                    ? `Have ${formatMoney(order.total, order.currencyCode)} ready ${allPickup ? "when you collect" : "for the rider"}.`
                    : order.paymentState === "collected"
                      ? allPickup
                        ? "Paid when you collected."
                        : "Paid to the rider on delivery."
                      : order.paymentState === "paid"
                        ? "Paid — nothing to pay on delivery."
                        : order.paymentState === "failed"
                          ? "Payment didn't go through."
                          : "Waiting for payment confirmation."}
                </p>
                {order.paymentState === "paid" ? <BuyerProtection className="mt-2" /> : null}
                {cod ? (
                  <p className="mt-2 inline-flex items-start gap-1.5 text-sm text-muted-foreground">
                    <HugeiconsIcon icon={SecurityCheckIcon} className="mt-0.5 size-4 shrink-0" aria-hidden />
                    alkemart never asks you to pay before a pay-on-delivery order arrives.
                  </p>
                ) : null}
              </div>
            </div>

            {order.shippingAddress && !allPickup ? (
              <div className="flex gap-3 rounded-3xl border border-border p-4 text-[15px] sm:p-5">
                <HugeiconsIcon icon={Location01Icon} className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
                <address className="not-italic">
                  <p className="font-semibold">Delivering to</p>
                  {formatAddressLines(order.shippingAddress).map((l) => (
                    <p key={l} className="text-muted-foreground">
                      {l}
                    </p>
                  ))}
                </address>
              </div>
            ) : null}

            <div className="rounded-3xl bg-surface p-4 text-[15px] sm:p-5">
              <p className="flex items-center gap-2 font-semibold">
                <HugeiconsIcon icon={Alert02Icon} className="size-5" aria-hidden />
                Something wrong?
              </p>
              <p className="mt-1 text-muted-foreground">
                Use “There's a problem” on the package to ask for a return or a replacement. For anything else, quote your order number.
              </p>
              <Button asChild variant="outline" className="mt-3">
                <Link to="/contact">Contact support</Link>
              </Button>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  )
}
