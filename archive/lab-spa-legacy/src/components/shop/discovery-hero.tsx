import { Button } from "@/components/ui/button";
import { MerchLink } from "@/lib/nav-link";

interface Props {
  eyebrow?: string;
  title?: string;
  /** Supporting line under the title (Ghana trust / value prop). */
  subtitle?: string;
  cta?: string;
  ctaTo?: string | null;
  imageUrl?: string | null;
}

/**
 * Marketplace hero — no fake carousel chrome for a single static promo.
 * When imageUrl is missing, use a simple brand panel instead of an empty image slot.
 */
export function DiscoveryHero({
  eyebrow = "alkemart Ghana",
  title = "Shop local vendors. Pay the way you already do.",
  subtitle,
  cta = "Browse the market",
  ctaTo = "/browse/all",
  imageUrl,
}: Props) {
  return (
    <div className="relative min-h-[280px] overflow-hidden rounded-xl bg-secondary md:min-h-[320px]">
      <div className="grid h-full items-center gap-4 p-6 md:grid-cols-[1fr_1.1fr] md:gap-6 md:p-8">
        <div className="max-w-md">
          <div className="text-eyebrow text-primary">{eyebrow}</div>
          <h2 className="mt-2 text-3xl font-bold leading-[1.1] tracking-tight text-foreground md:text-5xl">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
              {subtitle}
            </p>
          ) : null}
          <Button
            size="lg"
            className="mt-6 rounded-full bg-primary px-6 font-bold text-primary-foreground hover:bg-primary-hover"
            asChild
          >
            <MerchLink to={ctaTo}>{cta}</MerchLink>
          </Button>
        </div>

        {imageUrl ? (
          <div className="hidden overflow-hidden rounded-lg md:block">
            <img
              src={imageUrl}
              alt=""
              className="aspect-video w-full object-cover"
            />
          </div>
        ) : (
          <div
            className="hidden min-h-[200px] flex-col justify-end rounded-lg border border-border/60 bg-gradient-to-br from-primary/25 via-card to-muted p-6 md:flex"
            aria-hidden
          >
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Ghana marketplace
            </p>
            <p className="mt-2 max-w-xs text-lg font-bold leading-snug text-foreground">
              MoMo · Card · Local sellers · GHS
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
