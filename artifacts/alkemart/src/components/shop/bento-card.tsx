import { Button } from "@/components/ui/button";
import { ImageSlot } from "./image-slot";
import { cn } from "@/lib/utils";

interface BentoCardProps {
  eyebrow?: string;
  title: string;
  cta?: string;
  size?: "sm" | "md" | "lg";
  tone?: "surface" | "surface-strong" | "muted" | "secondary" | "accent" | "primary";
  imageTone?: "default" | "brand" | "accent";
  imageRatio?: number;
  className?: string;
  themeBg?: string;
  themeFg?: string;
}

const toneMap = {
  surface: "bg-surface text-foreground",
  "surface-strong": "bg-surface-strong/30 text-foreground",
  muted: "bg-muted text-foreground",
  secondary: "bg-secondary/10 text-secondary border-secondary/20",
  accent: "bg-accent/15 text-accent border-accent/25",
  primary: "bg-primary/10 text-primary",
};

export function BentoCard({
  eyebrow,
  title,
  cta = "Shop now",
  size = "md",
  tone = "surface",
  imageTone = "default",
  imageRatio,
  className,
  themeBg,
  themeFg,
}: BentoCardProps) {
  const ratio = imageRatio ?? (size === "lg" ? 2 : size === "md" ? 4 / 3 : 16 / 9);
  const padding = size === "lg" ? "p-6" : "p-4";
  const titleSize =
    size === "lg" ? "text-3xl" : size === "md" ? "text-lg" : "text-base";
  const hasThemeOverride = Boolean(themeBg);
  return (
    <div
      className={cn(
        "flex flex-col justify-between gap-3 rounded-md border border-border",
        padding,
        !hasThemeOverride && toneMap[tone],
        className,
      )}
      style={hasThemeOverride ? { backgroundColor: themeBg, color: themeFg } : undefined}
    >
      <div>
        {eyebrow && (
          <div className="text-[10px] font-bold uppercase tracking-widest opacity-70">
            {eyebrow}
          </div>
        )}
        <h3
          className={cn(
            "mt-1 font-display font-bold leading-tight tracking-tight",
            titleSize,
          )}
        >
          {title}
        </h3>
        {size === "lg" ? (
          <Button className="mt-4" size="lg">
            {cta}
          </Button>
        ) : (
          <span className="mt-2 inline-block cursor-default text-xs font-semibold text-primary underline">
            {cta}
          </span>
        )}
      </div>
      <ImageSlot ratio={ratio} rounded="md" tone={imageTone} />
    </div>
  );
}
