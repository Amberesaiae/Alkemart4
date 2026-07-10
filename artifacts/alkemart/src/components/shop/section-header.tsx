import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  eyebrow?: string;
  linkLabel?: string;
  linkTo?: string;
  className?: string;
}

export function SectionHeader({
  title,
  eyebrow,
  linkLabel = "Shop all",
  linkTo,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-4", className)}>
      <div>
        {eyebrow && (
          <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">
            {eyebrow}
          </div>
        )}
        <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
          {title}
        </h2>
      </div>
      {linkTo && (
        <Link
          to={linkTo}
          className="text-sm font-semibold text-foreground underline underline-offset-4 hover:text-primary"
        >
          {linkLabel}
        </Link>
      )}
    </div>
  );
}
