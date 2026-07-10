import { Button } from "@/components/ui/button";
import { ImageSlot } from "./image-slot";
import { cn } from "@/lib/utils";

interface Props {
  eyebrow?: string;
  title: string;
  cta?: string;
  imagePosition?: "left" | "right";
  tone?: "surface" | "surface-strong" | "muted" | "secondary" | "primary" | "accent";
  className?: string;
  minHeight?: string;
  themeBg?: string;
  themeFg?: string;
  imageUrl?: string | null;
}

const toneMap = {
  surface: "bg-surface text-foreground",
  "surface-strong": "bg-surface-strong text-foreground",
  muted: "bg-muted text-foreground",
  secondary: "bg-secondary text-foreground",
  primary: "bg-primary text-primary-foreground",
  accent: "bg-accent text-accent-foreground",
};

export function HeroSplit({
  eyebrow,
  title,
  cta = "Shop now",
  imagePosition = "right",
  tone = "surface-strong",
  className,
  minHeight = "420px",
  themeBg,
  themeFg,
  imageUrl,
}: Props) {
  const hasThemeOverride = Boolean(themeBg);
  return (
    <div
      className={cn(
        "grid overflow-hidden rounded-2xl md:grid-cols-2",
        !hasThemeOverride && toneMap[tone],
        className,
      )}
      style={{ minHeight, ...(hasThemeOverride ? { backgroundColor: themeBg, color: themeFg } : undefined) }}
    >
      {imagePosition === "left" && (
        <div className="relative">
          <ImageSlot ratio={4 / 3} rounded="sm" tone="brand" className="h-full" src={imageUrl} alt={title} />
        </div>
      )}
      <div className="flex flex-col justify-center gap-6 p-10">
        {eyebrow && (
          <div className="text-xs font-bold uppercase tracking-widest opacity-80">
            {eyebrow}
          </div>
        )}
        <h2 className="font-display text-4xl font-bold leading-[1.05] tracking-tight md:text-5xl">
          {title}
        </h2>
        <div>
          <Button size="lg" variant={tone === "primary" ? "accent" : "default"}>
            {cta}
          </Button>
        </div>
      </div>
      {imagePosition === "right" && (
        <div className="relative">
          <ImageSlot ratio={4 / 3} rounded="sm" tone="brand" className="h-full" src={imageUrl} alt={title} />
        </div>
      )}
    </div>
  );
}
