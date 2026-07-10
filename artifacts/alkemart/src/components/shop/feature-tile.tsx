import { ImageSlot } from "./image-slot";
import { cn } from "@/lib/utils";

interface FeatureTileProps {
  tone?: "surface" | "secondary" | "accent" | "primary" | "surface-strong" | "muted";
  eyebrow?: string;
  title: string;
  body?: string;
  link?: string;
  layout?: "split" | "stacked" | "compact";
  imageTone?: "default" | "brand" | "accent";
  imageRatio?: number;
  imageShape?: "circle" | "square" | "portrait";
  minHeight?: string;
  className?: string;
}

const toneMap = {
  surface: "bg-surface text-foreground",
  "surface-strong": "bg-surface-strong text-foreground",
  muted: "bg-muted text-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  accent: "bg-accent text-accent-foreground",
  primary: "bg-primary text-primary-foreground",
};

export function FeatureTile({
  tone = "surface",
  eyebrow,
  title,
  body,
  link = "Learn more",
  layout = "split",
  imageTone = "brand",
  imageRatio = 1,
  imageShape = "square",
  minHeight,
  className,
}: FeatureTileProps) {
  const rounded = imageShape === "circle" ? "full" : "md";
  if (layout === "stacked") {
    return (
      <div
        className={cn(
          "flex flex-col justify-between gap-4 rounded-md border border-border p-5",
          toneMap[tone],
          className,
        )}
        style={{ minHeight }}
      >
        <div>
          {eyebrow && (
            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest opacity-70">
              {eyebrow}
            </div>
          )}
          <h3 className="font-display text-lg font-bold leading-tight">{title}</h3>
          {body && <p className="mt-1 text-xs opacity-80">{body}</p>}
          <span className="mt-2 inline-block cursor-default text-xs font-semibold underline underline-offset-4">
            {link}
          </span>
        </div>
        <ImageSlot ratio={imageRatio} rounded={rounded} tone={imageTone} />
      </div>
    );
  }
  if (layout === "compact") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-md border border-border p-4",
          toneMap[tone],
          className,
        )}
        style={{ minHeight }}
      >
        <div className="w-20 shrink-0">
          <ImageSlot ratio={1} rounded={rounded} tone={imageTone} />
        </div>
        <div className="min-w-0">
          <h4 className="font-display text-sm font-bold leading-tight">{title}</h4>
          <span className="mt-1 inline-block cursor-default text-xs font-semibold underline">
            {link}
          </span>
        </div>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "grid grid-cols-[1fr_140px] items-center gap-4 rounded-md border border-border p-6",
        toneMap[tone],
        className,
      )}
      style={{ minHeight }}
    >
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-1 text-[10px] font-bold uppercase tracking-widest opacity-70">
            {eyebrow}
          </div>
        )}
        <h3 className="font-display text-2xl font-bold leading-tight">{title}</h3>
        {body && <p className="mt-1 text-sm opacity-80">{body}</p>}
        <span className="mt-3 inline-block cursor-default text-sm font-semibold underline underline-offset-4">
          {link}
        </span>
      </div>
      <ImageSlot ratio={imageRatio} rounded={rounded} tone={imageTone} />
    </div>
  );
}
