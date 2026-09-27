import type { ReactNode } from "react"
import { formatMinor } from "../../lib/money"
import { cn } from "../../lib/utils"

/** A return as the API sends it to the seller and admin consoles. Amounts are minor-unit strings. */
export type ConsoleReturnCase = {
  id: string
  status: "requested" | "declined" | "escalated" | "closed"
  waitingOn: "seller" | "buyer" | "admin" | null
  respondBy: string | null
  reasonLabel: string
  wish: "refund" | "swap"
  note: string
  declineReason: string | null
  outcome: "refund" | "swap" | "declined" | "withdrawn" | null
  refund: { amountPesewas: string; via: "provider" | "seller" | null; status: "pending" | "paid" | "failed" | "owed" | null } | null
  adminNote: string | null
  sellerRecoveryPesewas?: string
  recovered?: boolean
  /** The seller was already paid for this order (null = not known here). */
  paidOut?: boolean | null
  /** Pay on delivery: the seller holds the cash and pays any refund back themselves. */
  payOnDelivery?: boolean | null
  timeline: { at: string; by: string; note: string }[]
}

const when = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso))

/** Headline + lines for a case, in the reader's words ("you" is the seller in the seller app). */
export function returnCaseText(rc: ConsoleReturnCase, viewer: "seller" | "admin"): { title: string; lines: string[]; tone: "act" | "wait" | "done" } {
  const you = viewer === "seller"
  const by = rc.respondBy ? when(rc.respondBy) : null
  const refund = rc.refund
  const recovery = BigInt(rc.sellerRecoveryPesewas ?? "0")
  switch (rc.status) {
    case "requested":
      return you
        ? {
            title: `Return request — reply by ${by}`,
            lines: [
              "If you don't reply in time, alkemart decides.",
              rc.payOnDelivery
                ? "The buyer paid you cash, so if you refund, you pay them back yourself."
                : rc.paidOut
                  ? "You've already been paid for this order; a refund comes off your next payout."
                  : "The payment for this order waits until it's settled.",
            ],
            tone: "act",
          }
        : { title: "Waiting for the seller", lines: [`Seller replies by ${by}; after that it comes here.`], tone: "wait" }
    case "declined":
      return { title: you ? "You declined" : "Seller declined", lines: [`Reason: “${rc.declineReason ?? ""}”`, "The buyer can accept it or ask alkemart to decide."], tone: "wait" }
    case "escalated":
      return you
        ? { title: "alkemart is deciding", lines: [rc.paidOut || rc.payOnDelivery ? "We'll look at both sides and let you know." : "We'll look at both sides and let you know. The payment for this order waits until then."], tone: "wait" }
        : {
            title: "Needs your decision",
            lines: [
              "The buyer and seller couldn't settle this, or a deadline passed.",
              rc.declineReason ? `Seller declined: “${rc.declineReason}”` : "",
              rc.payOnDelivery
                ? "Pay on delivery: the seller holds the cash and pays any refund back themselves."
                : rc.paidOut
                  ? "The seller was already paid for this order — a refund is taken from their next payout."
                  : "",
            ].filter(Boolean),
            tone: "act",
          }
    default: {
      const lines: string[] = []
      let title = "Closed"
      let tone: "act" | "done" = "done"
      if (refund && rc.outcome === "refund") {
        title = `Refunded ${formatMinor(refund.amountPesewas)}`
        if (refund.via === "seller") {
          if (refund.status === "owed") {
            lines.push(you ? `Pay the buyer back ${formatMinor(refund.amountPesewas)} yourself, then mark it paid.` : "The seller pays the buyer back (pay on delivery).")
            tone = you ? "act" : "done"
          } else lines.push(you ? "You paid the buyer back." : "Seller says they paid the buyer back.")
        } else {
          lines.push(
            refund.status === "failed"
              ? "The refund didn't go through at Paystack — alkemart is sending it again."
              : refund.status === "paid"
                ? "Refunded to the buyer through alkemart."
                : "On its way to the buyer through alkemart.",
          )
          if (recovery > 0n) {
            lines.push(
              rc.recovered
                ? `${formatMinor(recovery)} (${you ? "your" : "the seller's"} share) was taken from a payout.`
                : `${formatMinor(recovery)} (${you ? "your" : "the seller's"} share) comes off ${you ? "your" : "their"} next payout — this order was already paid out.`,
            )
          }
        }
      } else if (rc.outcome === "swap") {
        title = "Replacement agreed"
        lines.push(you ? "Arrange the replacement with the buyer." : "Seller arranges the replacement.")
      } else if (rc.outcome === "declined") {
        title = "Closed — declined"
      } else if (rc.outcome === "withdrawn") {
        title = "Closed — the buyer said it's sorted"
      }
      if (rc.adminNote) lines.push(`alkemart's decision: “${rc.adminNote}”`)
      return { title, lines, tone }
    }
  }
}

/**
 * One return: what the buyer asked, where it stands, and its history. Actions
 * (different for seller and admin) go in `children`, rendered inline.
 */
export function ReturnCaseCard({ rc, viewer, children, className }: { rc: ConsoleReturnCase; viewer: "seller" | "admin"; children?: ReactNode; className?: string }) {
  const t = returnCaseText(rc, viewer)
  return (
    <section
      aria-label="Return"
      className={cn(
        "space-y-3 rounded-2xl border-2 p-4 text-[15px] sm:p-5",
        t.tone === "act" ? "border-warning bg-warning-soft" : t.tone === "wait" ? "border-border bg-card" : "border-border bg-muted/40",
        className,
      )}
    >
      <div role="status">
        <p className="text-lg font-bold">{t.title}</p>
        {t.lines.map((l) => (
          <p key={l} className="mt-1">
            {l}
          </p>
        ))}
      </div>
      <div className="rounded-xl bg-background/70 p-3">
        <p className="text-sm font-semibold">
          {rc.reasonLabel} · the buyer wants {rc.wish === "swap" ? "a replacement" : "their money back"}
        </p>
        <p className="mt-0.5 [overflow-wrap:anywhere]">“{rc.note}”</p>
      </div>
      {children}
      {rc.timeline.length ? (
        <details className="text-sm">
          <summary className="inline-flex min-h-9 cursor-pointer items-center font-semibold">History ({rc.timeline.length})</summary>
          <ol className="mt-1 space-y-1 text-muted-foreground">
            {rc.timeline.map((e) => (
              <li key={`${e.at}-${e.note}`}>
                <span className="tabular">{when(e.at)}</span> · {e.note}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </section>
  )
}
