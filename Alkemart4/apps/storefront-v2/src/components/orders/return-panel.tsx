import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { formatMoney } from "@/lib/market"
import { askForReturn, reportProblem, respondToReturn, type ReturnCase, type ReturnReason, type SellerOrder } from "@/lib/orders"
import { cn } from "@/lib/utils"

const when = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso))
const dayOnly = (iso: string) => new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" }).format(new Date(iso))

/** "Just tell the seller" — the phase-1 note, for anything that isn't a return. */
const TELL = "tell" as const

const textareaCls =
  "w-full rounded-2xl border border-input bg-background px-3.5 py-2.5 text-[15px] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

function Choice({ active, onClick, title, line }: { active: boolean; onClick: () => void; title: string; line?: string | null }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex min-h-11 w-full items-start gap-3 rounded-2xl border-2 p-3 text-left text-[15px] transition-colors",
        active ? "border-foreground bg-surface" : "border-border hover:border-foreground/30",
      )}
    >
      <span aria-hidden className={cn("mt-1 grid size-4 shrink-0 place-items-center rounded-full border-2", active ? "border-foreground" : "border-muted-foreground")}>
        {active ? <span className="size-2 rounded-full bg-foreground" /> : null}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">{title}</span>
        {line ? <span className="block text-sm text-muted-foreground">{line}</span> : null}
      </span>
    </button>
  )
}

/**
 * "There's a problem": what's wrong, what the buyer would like, and a note.
 * Return reasons (and their last day) come from the API; "just tell the
 * seller" keeps the phase-1 note for anything else. All inline.
 */
export function ProblemForm({ so, who, currency, onClose }: { so: SellerOrder; who: string; currency: string; onClose: () => void }) {
  const qc = useQueryClient()
  const options = so.returnOptions
  const [reason, setReason] = useState<ReturnReason | typeof TELL | null>(options ? null : TELL)
  const [wish, setWish] = useState<"refund" | "swap">("refund")
  const [note, setNote] = useState("")
  const picked = options?.reasons.find((r) => r.reason === reason) ?? null
  const done = () => void qc.invalidateQueries({ queryKey: ["store", "order"] })
  const send = useMutation({
    mutationFn: () =>
      reason === TELL || !reason ? reportProblem(so.id, note.trim(), who) : askForReturn(so.id, { reason, wish, note: note.trim() }, who),
    onSuccess: () => {
      toast.success(reason === TELL ? "Sent to the seller. Their payment for this order waits until it's sorted." : "Sent. The seller has been asked to reply.")
      onClose()
      done()
    },
    onError: (e: unknown) => toast.error((e as Error).message || "That didn't go through. Try again."),
  })
  const shop = so.seller?.name ?? "The seller"

  return (
    <form
      className="space-y-4 rounded-2xl border border-border p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (note.trim().length >= 5 && reason) send.mutate()
      }}
    >
      {options ? (
        <div role="radiogroup" aria-labelledby={`why-${so.id}`} className="space-y-2">
          <p id={`why-${so.id}`} className="font-semibold">
            What's wrong?
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {options.reasons.map((r) => (
              <Choice key={r.reason} active={reason === r.reason} onClick={() => setReason(r.reason)} title={r.label} line={r.until ? `Ask by ${dayOnly(r.until)}` : null} />
            ))}
            <Choice active={reason === TELL} onClick={() => setReason(TELL)} title="Something else" line="Just tell the seller" />
          </div>
        </div>
      ) : null}

      {reason && reason !== TELL ? (
        <div role="radiogroup" aria-labelledby={`wish-${so.id}`} className="space-y-2">
          <p id={`wish-${so.id}`} className="font-semibold">
            What would you like?
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Choice
              active={wish === "refund"}
              onClick={() => setWish("refund")}
              title="My money back"
              line={options?.refundable != null ? `Up to ${formatMoney(options.refundable, currency)} for the items` : null}
            />
            <Choice active={wish === "swap"} onClick={() => setWish("swap")} title="A replacement" />
          </div>
        </div>
      ) : null}

      {reason ? (
        <div className="space-y-1.5">
          <Label htmlFor={`note-${so.id}`}>{reason === TELL ? "What's wrong?" : "Tell the seller what happened"}</Label>
          <textarea
            id={`note-${so.id}`}
            rows={3}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. The screen is cracked in the top corner."
            className={textareaCls}
          />
          <p className="text-sm text-muted-foreground">
            {reason === TELL
              ? `${shop} is told straight away, and their payment for this order waits until you mark it sorted.`
              : `${shop} gets a set time to reply. If they don't, or you can't agree, alkemart decides.${picked?.until ? ` You can ask until ${when(picked.until)}.` : ""}`}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={!reason || note.trim().length < 5 || send.isPending}>
          {reason === TELL ? "Tell the seller" : "Send to the seller"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

/** Where a return stands, in the buyer's words, with their next step inline. */
export function ReturnStatus({ so, rc, who, currency }: { so: SellerOrder; rc: ReturnCase; who: string; currency: string }) {
  const qc = useQueryClient()
  const shop = so.seller?.name ?? "The seller"
  const money = (n: number | null | undefined) => formatMoney(n ?? null, currency)
  const act = useMutation({
    mutationFn: (a: "accept" | "escalate" | "withdraw") => respondToReturn(so.id, a, who),
    onSuccess: (_d, a) => {
      toast.success(a === "escalate" ? "alkemart will look at it and let you know." : a === "withdraw" ? "Glad it's sorted." : "Done.")
      void qc.invalidateQueries({ queryKey: ["store", "order"] })
    },
    onError: (e: unknown) => toast.error((e as Error).message || "That didn't go through. Try again."),
  })
  const by = rc.respondBy ? when(rc.respondBy) : null
  const asked = `${rc.reasonLabel} · you asked for ${rc.wish === "swap" ? "a replacement" : "your money back"}`

  let title: string
  let lines: string[] = []
  let actions: { label: string; a: "accept" | "escalate" | "withdraw"; primary?: boolean }[] = []
  switch (rc.status) {
    case "requested":
      title = "Return asked — waiting for the seller"
      lines = [`${shop} has until ${by} to reply. If they don't, alkemart decides.`]
      actions = [{ label: "It's sorted", a: "withdraw" }]
      break
    case "declined":
      title = `${shop} declined your return`
      lines = [`Their reason: “${rc.declineReason ?? ""}”`, "Don't agree? Ask alkemart to decide."]
      actions = [
        { label: "Ask alkemart to decide", a: "escalate", primary: true },
        { label: "OK, close it", a: "accept" },
      ]
      break
    case "escalated":
      title = "alkemart is deciding"
      lines = ["We're looking at both sides and will email you. Nothing for you to do."]
      actions = [{ label: "It's sorted", a: "withdraw" }]
      break
    default: {
      const refund = rc.refund
      if (rc.outcome === "refund") {
        title = `Refunded ${money(refund?.amount)}`
        lines = [
          refund?.via === "seller"
            ? refund.status === "paid"
              ? `${shop} says they've paid you back.`
              : `${shop} pays you back directly.`
            : refund?.status === "paid"
              ? "Back to how you paid."
              : refund?.status === "failed"
                ? "The refund didn't go through the first time — alkemart is sending it again."
                : "On its way to how you paid. It can take a few days to show.",
        ]
      } else if (rc.outcome === "swap") {
        title = "Replacement agreed"
        lines = [`${shop} will arrange it with you.`]
      } else if (rc.outcome === "declined") {
        title = "Return closed"
        lines = ["The seller's answer stands."]
      } else {
        title = "You closed this return"
      }
      if (rc.adminNote) lines.push(`alkemart's decision: “${rc.adminNote}”`)
    }
  }
  const open = rc.status !== "closed"

  return (
    <div role="status" className={cn("space-y-3 rounded-2xl border-2 p-4 text-[15px]", open ? "border-warning bg-warning/10" : "border-border bg-surface")}>
      <div>
        <p className="font-bold">{title}</p>
        <p className="text-sm text-muted-foreground">{asked}</p>
      </div>
      {lines.filter(Boolean).map((l) => (
        <p key={l}>{l}</p>
      ))}
      {actions.length ? (
        <div className="flex flex-wrap gap-2">
          {actions.map((x) => (
            <Button key={x.a} size="sm" variant={x.primary ? "default" : "outline"} disabled={act.isPending} onClick={() => act.mutate(x.a)}>
              {x.label}
            </Button>
          ))}
        </div>
      ) : null}
      {rc.timeline.length > 1 ? (
        <details className="text-sm">
          <summary className="inline-flex min-h-9 cursor-pointer items-center font-semibold">History</summary>
          <ol className="mt-1 space-y-1 text-muted-foreground">
            {rc.timeline.map((t) => (
              <li key={`${t.at}-${t.note}`}>
                <span className="tabular">{when(t.at)}</span> · {t.note}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  )
}
