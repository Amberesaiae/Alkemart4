import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MerchLink } from "@/lib/nav-link";

interface AnnouncementYellowProps {
  headline?: string;
  cta?: string;
  ctaTo?: string | null;
  /** Optional static display only — not a live timer unless endsAt provided later */
  countdown?: [string, string, string] | null;
  className?: string;
}

/**
 * Promo band (yellow accent). CTA is a real link when ctaTo is set.
 * Countdown is optional; omit it rather than invent a fake timer.
 * Default copy: Ghana payments — not US seasons or membership+ framing.
 */
export function AnnouncementYellow({
  headline = "Pay with MoMo, card, or bank — MTN · Telecel · AT",
  cta = "Shop now",
  ctaTo = "/browse/all",
  countdown = null,
  className,
}: AnnouncementYellowProps) {
  const labels = ["day", "hour", "mins"];
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-between gap-3 rounded-md bg-accent px-4 py-3 text-accent-foreground md:flex-row md:gap-4",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="shrink-0 rounded-sm bg-foreground px-2 py-1 text-xs font-bold text-background">
          Ghana
        </div>
        <p className="text-sm font-semibold leading-snug">{headline}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {countdown && (
          <div className="text-right">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-accent-foreground/80">
              Offer ends in
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 font-mono text-base font-bold tabular-nums">
              {countdown.map((n, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="flex flex-col items-center">
                    <span>{n}</span>
                    <span className="text-[9px] font-semibold text-accent-foreground/75">
                      {labels[i]}
                    </span>
                  </div>
                  {i < countdown.length - 1 && <span className="pb-3">:</span>}
                </div>
              ))}
            </div>
          </div>
        )}
        <Button
          size="sm"
          className="rounded-full bg-primary font-bold text-primary-foreground hover:bg-primary-hover"
          asChild
        >
          <MerchLink to={ctaTo}>{cta}</MerchLink>
        </Button>
      </div>
    </div>
  );
}
