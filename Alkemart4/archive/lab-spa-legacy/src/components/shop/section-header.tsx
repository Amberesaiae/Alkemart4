import { cn } from "@/lib/utils";
import { MerchLink, resolveCtaHref } from "@/lib/nav-link";

interface SectionHeaderProps {
  title: string;
  eyebrow?: string;
  linkLabel?: string;
  /** Path template or absolute path. Omit to hide the action. */
  linkTo?: string | null;
  className?: string;
}

/**
 * Section title left + blue text action right when linkTo resolves.
 */
export function SectionHeader({
  title,
  eyebrow,
  linkLabel = "View all",
  linkTo = "/browse/all",
  className,
}: SectionHeaderProps) {
  const href = linkTo ? resolveCtaHref(linkTo) : null;

  return (
    <div className={cn("mb-2 flex items-baseline justify-between gap-3", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="text-eyebrow mb-0.5">{eyebrow}</div>}
        <h2 className="text-section-title truncate">{title}</h2>
      </div>
      {href && (
        <MerchLink to={href} className="text-link-action shrink-0 whitespace-nowrap">
          {linkLabel}
        </MerchLink>
      )}
    </div>
  );
}
