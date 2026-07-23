import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

interface CategoryTileProps {
  label: string;
  imageTone?: "default" | "brand" | "accent";
  /** Browse slug; defaults to slugified label */
  slug?: string;
  className?: string;
}

function toSlug(label: string) {
  return label
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Soft brand tones — no empty image placeholders. */
const TILE_TONES = [
  "bg-primary/20 text-foreground",
  "bg-secondary text-foreground",
  "bg-muted text-foreground",
  "bg-accent/40 text-accent-foreground",
  "bg-primary/10 text-foreground",
] as const;

function toneFor(label: string) {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h + label.charCodeAt(i) * (i + 1)) % TILE_TONES.length;
  return TILE_TONES[h];
}

/**
 * Category entry point — letter chip + label (no blank image slots).
 */
export function CategoryTile({
  label,
  slug,
  className,
}: CategoryTileProps) {
  const browseSlug = slug ?? toSlug(label);
  const letter = (label.trim()[0] || "?").toUpperCase();

  return (
    <Link
      to="/browse/$slug"
      params={{ slug: browseSlug }}
      className={cn(
        "group flex flex-col gap-2 overflow-hidden rounded-xl border border-transparent p-1.5 text-center transition-colors",
        "hover:border-border hover:bg-card hover:shadow-sm",
        className,
      )}
    >
      <div
        className={cn(
          "flex aspect-square w-full items-center justify-center rounded-lg text-2xl font-bold tracking-tight transition-transform group-hover:scale-[1.02]",
          toneFor(label),
        )}
        aria-hidden
      >
        {letter}
      </div>
      <div className="line-clamp-2 px-0.5 text-xs font-semibold leading-snug text-foreground group-hover:text-primary">
        {label}
      </div>
    </Link>
  );
}
