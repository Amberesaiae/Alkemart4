import { cn } from "@/lib/utils";

export type PaymentChannelId =
  | "mtn"
  | "telecel"
  | "at"
  | "card"
  | "bank";

const CHANNELS: {
  id: PaymentChannelId;
  label: string;
  short: string;
  /** Brief tone for visual distinction without inventing brand IP. */
  tone: string;
}[] = [
  { id: "mtn", label: "MTN Mobile Money", short: "MTN MoMo", tone: "bg-foreground text-background" },
  { id: "telecel", label: "Telecel Cash", short: "Telecel", tone: "bg-card text-foreground border-border" },
  { id: "at", label: "AT Money", short: "AT Money", tone: "bg-card text-foreground border-border" },
  { id: "card", label: "Card (Visa / Mastercard)", short: "Card", tone: "bg-muted text-foreground border-border" },
  { id: "bank", label: "Bank transfer", short: "Bank", tone: "bg-muted text-foreground border-border" },
];

export type PaymentChannelBadgesProps = {
  /** Which channels to show. Default: MoMo networks + card. */
  channels?: PaymentChannelId[];
  /** Compact for PDP buy box / header; full for checkout. */
  size?: "sm" | "md";
  /** Show “via Paystack” trust footnote. */
  showPaystack?: boolean;
  className?: string;
  footnoteClassName?: string;
};

/**
 * Honest payment-channel chips for Ghana checkout trust.
 * Labels only — no SNAP-style eligibility logic; availability confirmed at pay.
 */
export function PaymentChannelBadges({
  channels = ["mtn", "telecel", "at", "card"],
  size = "sm",
  showPaystack = true,
  className,
  footnoteClassName,
}: PaymentChannelBadgesProps) {
  const items = CHANNELS.filter((c) => channels.includes(c.id));
  const pad = size === "md" ? "px-2.5 py-1 text-[11px]" : "px-2 py-0.5 text-[10px]";

  return (
    <div className={cn("space-y-1.5", className)}>
      <ul className="flex flex-wrap gap-1.5" aria-label="Accepted payment methods">
        {items.map((c) => (
          <li key={c.id}>
            <span
              title={c.label}
              className={cn(
                "inline-flex items-center rounded-full border font-semibold tracking-tight",
                pad,
                c.tone,
              )}
            >
              {c.short}
            </span>
          </li>
        ))}
      </ul>
      {showPaystack ? (
        <p className={cn("text-[11px] text-muted-foreground", footnoteClassName)}>
          Processed securely via{" "}
          <span className="font-semibold text-foreground">Paystack</span>
          {" "}where enabled. MoMo requires approval on your phone.
        </p>
      ) : null}
    </div>
  );
}
