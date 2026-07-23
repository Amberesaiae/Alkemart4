import { cn } from "@/lib/utils";
import { PaymentChannelBadges } from "./payment-channel-badges";

/**
 * Compact pay-trust line for PDP / rails.
 * Replaces the old US-style “alkemart+” membership framing.
 */
export function AlkemartPlusInline({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="text-[11px] font-semibold text-foreground">Pay the Ghana way</div>
      <PaymentChannelBadges
        channels={["mtn", "telecel", "at", "card"]}
        size="sm"
        showPaystack
      />
    </div>
  );
}
