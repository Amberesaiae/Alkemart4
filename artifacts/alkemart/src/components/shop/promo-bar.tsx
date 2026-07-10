import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PromoBarProps {
  className?: string;
}

export function PromoBar({ className }: PromoBarProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl bg-accent px-6 py-3 text-accent-foreground md:flex-row md:justify-between",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-foreground/10">
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
            <path d="M12 2 4 6v6c0 5 3.5 9.7 8 10 4.5-.3 8-5 8-10V6l-8-4Z" />
          </svg>
        </div>
        <p className="text-sm font-semibold md:text-base">
          Hurry &amp; get 50% off a year of membership while it lasts!
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 font-mono text-xs font-bold tabular-nums">
          {["01", "05", "29"].map((n, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className="rounded-md bg-accent-foreground/10 px-2 py-1">{n}</span>
              {i < 2 && <span>:</span>}
            </div>
          ))}
        </div>
        <Button size="sm" variant="outline" className="border-accent-foreground/30 bg-background">
          Claim offer
        </Button>
      </div>
    </div>
  );
}
