import { getMercurVendorUrl } from "@/lib/platform-features";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SellerCtaBandProps {
  eyebrow?: string;
  title?: string;
  body?: string;
  cta?: string;
  className?: string;
}

/**
 * Home / discovery CTA to Mercur Vendor Hub (ops live outside the buyer SPA).
 */
export function SellerCtaBand({
  eyebrow = "Sell on alkemart",
  title = "List your products for Ghana shoppers",
  body = "Register your store in the Seller Hub. After approval you can list products and manage orders there.",
  cta = "Open Seller Hub",
  className,
}: SellerCtaBandProps) {
  const sellerHubUrl = getMercurVendorUrl();

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card",
        className,
      )}
    >
      <div className="flex flex-col items-start justify-between gap-6 p-6 md:flex-row md:items-center md:p-8">
        <div className="max-w-xl">
          <div className="text-eyebrow text-primary">{eyebrow}</div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
        </div>
        <Button
          size="lg"
          className="shrink-0 rounded-full bg-primary px-6 font-bold text-primary-foreground hover:bg-primary-hover"
          asChild
        >
          <a href={sellerHubUrl} target="_blank" rel="noopener noreferrer">
            {cta}
          </a>
        </Button>
      </div>
    </section>
  );
}
