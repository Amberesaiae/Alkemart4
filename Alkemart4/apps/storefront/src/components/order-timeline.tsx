import type { StoreOrder } from "@/lib/orders"
import { cn } from "@/lib/utils"

type TimelineStep = {
  label: string
  description: string
  done: boolean
  current: boolean
  icon: string
}

function buildSteps(order: StoreOrder): TimelineStep[] {
  const isCancelled = order.status === "cancelled" || order.status === "archived"
  const paymentDone =
    order.paymentStatus === "captured" || order.paymentStatus === "paid"
  const fulfillmentDone =
    order.fulfillmentStatus === "fulfilled" ||
    order.fulfillmentStatus === "shipped" ||
    order.fulfillmentStatus === "delivered" ||
    order.fulfillmentStatus === "partially_fulfilled"

  const steps: TimelineStep[] = [
    {
      label: "Order placed",
      description: "Your order has been received",
      done: true,
      current: false,
      icon: "✓",
    },
    {
      label: "Payment confirmed",
      description: paymentDone
        ? "Payment received"
        : order.status === "pending"
          ? "Awaiting payment confirmation"
          : "Payment pending",
      done: paymentDone,
      current: !paymentDone && !isCancelled,
      icon: paymentDone ? "✓" : "2",
    },
  ]

  if (isCancelled) {
    steps.push({
      label: "Cancelled",
      description: "This order has been cancelled",
      done: false,
      current: true,
      icon: "✕",
    })
    return steps
  }

  steps.push({
    label: "Processing",
    description: fulfillmentDone
      ? "Order fulfilled"
      : order.fulfillmentStatus === "not_fulfilled"
        ? "Preparing your items"
        : "In progress",
    done: fulfillmentDone,
    current: paymentDone && !fulfillmentDone,
    icon: fulfillmentDone ? "✓" : "3",
  })

  if (
    order.fulfillmentStatus === "shipped" ||
    order.fulfillmentStatus === "delivered"
  ) {
    steps.push({
      label: "Shipped",
      description: "On its way to you",
      done: order.fulfillmentStatus === "delivered",
      current: order.fulfillmentStatus === "shipped",
      icon: order.fulfillmentStatus === "delivered" ? "✓" : "4",
    })
  }

  if (order.fulfillmentStatus === "delivered") {
    steps.push({
      label: "Delivered",
      description: "Order completed",
      done: true,
      current: false,
      icon: "✓",
    })
  }

  return steps
}

type Props = {
  order: StoreOrder
  className?: string
}

export function OrderTimeline({ order, className }: Props) {
  const steps = buildSteps(order)
  const isCancelled = order.status === "cancelled" || order.status === "archived"

  return (
    <div
      className={cn("rounded-3xl border border-border bg-card p-5 shadow-sm", className)}
      role="list"
      aria-label="Order status"
    >
      <div className="relative">
        {steps.map((step, i) => (
          <div
            key={step.label}
            className={cn(
              "relative flex gap-4 pb-8",
              i === steps.length - 1 && "pb-0",
            )}
            role="listitem"
          >
            {i < steps.length - 1 && !(i === steps.length - 2 && isCancelled) ? (
              <div
                className={cn(
                  "absolute left-[15px] top-8 w-0.5",
                  step.done ? "bg-primary" : "bg-border",
                )}
                style={{ height: "calc(100% - 8px)" }}
                aria-hidden
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                step.done && "bg-primary text-primary-foreground",
                step.current && !step.done && "ring-2 ring-primary ring-offset-2 ring-offset-card bg-muted text-foreground",
                !step.done && !step.current && "bg-muted text-muted-foreground",
              )}
              aria-current={step.current ? "step" : undefined}
            >
              {step.icon}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p
                className={cn(
                  "text-sm font-semibold",
                  step.done
                    ? "text-foreground"
                    : step.current
                      ? "text-foreground"
                      : "text-muted-foreground",
                )}
              >
                {step.label}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
