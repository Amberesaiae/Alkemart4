import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AnnouncementYellowProps {
  headline?: string;
  countdown?: [string, string, string];
  className?: string;
}

export function AnnouncementYellow({
  headline = "Hurry & get 50% off a year of alkemart+ while it lasts!",
  countdown = ["01", "05", "29"],
  className,
}: AnnouncementYellowProps) {
  const labels = ["day", "hour", "mins"];
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-between gap-4 rounded-3xl bg-accent px-6 py-5 text-accent-foreground md:flex-row",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg bg-background px-3 py-1.5 font-display text-lg font-bold text-primary">
          <span>alkemart</span>
          <span className="text-accent-foreground">+</span>
        </div>
        <p className="text-sm font-bold md:text-lg">{headline}</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-[10px] font-semibold uppercase text-accent-foreground/90">Your offer ends in:</div>
          <div className="mt-0.5 flex items-center gap-2 font-mono text-lg font-bold tabular-nums">
            {countdown.map((n, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex flex-col items-center">
                  <span>{n}</span>
                  <span className="text-[9px] font-semibold text-accent-foreground/90">{labels[i]}</span>
                </div>
                {i < countdown.length - 1 && <span className="pb-3">:</span>}
              </div>
            ))}
          </div>
        </div>
        <Button size="sm" variant="outline" className="border-accent-foreground/30 bg-background">
          Claim offer
        </Button>
      </div>
    </div>
  );
}
