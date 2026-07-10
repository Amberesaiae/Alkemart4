import { ImageSlot } from "./image-slot";
import { cn } from "@/lib/utils";

interface CategoryTileProps {
  label: string;
  imageTone?: "default" | "brand" | "accent";
  linkTo?: string;
  className?: string;
}

/**
 * Canonical category display — a rounded card/tile, never a circle. Used on
 * the homepage category rows and the browse page's "related categories".
 */
export function CategoryTile({ label, imageTone = "brand", linkTo = "#", className }: CategoryTileProps) {
  return (
    <a
      href={linkTo}
      className={cn(
        "group flex flex-col gap-2 overflow-hidden rounded-2xl border border-transparent p-1.5 text-center transition-colors hover:border-border hover:bg-surface",
        className,
      )}
    >
      <div className="w-full">
        <ImageSlot ratio={1} rounded="lg" tone={imageTone} />
      </div>
      <div className="text-xs font-semibold group-hover:text-primary">{label}</div>
    </a>
  );
}
