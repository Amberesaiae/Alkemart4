import { ArrowRightIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import { ImageSlot } from "./image-slot";
import { cn } from "@/lib/utils";

interface HeroTileProps {
  tone?: "accent" | "primary" | "secondary" | "surface";
  eyebrow?: string;
  title: string;
  cta?: string;
  minHeight?: string;
  className?: string;
  imageRatio?: number;
  imageAlign?: "right" | "bottom" | "hidden";
  imageTone?: "default" | "brand" | "accent";
}

const toneMap = {
  accent: "bg-accent text-accent-foreground",
  primary: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  surface: "bg-surface-strong text-foreground",
};

export function HeroTile({
  tone = "accent",
  eyebrow,
  title,
  cta = "Shop now",
  minHeight = "320px",
  className,
  imageRatio = 16 / 9,
  imageAlign = "right",
  imageTone = "brand",
}: HeroTileProps) {
  const ctaVariant = tone === "accent" ? "default" : tone === "primary" ? "accent" : "default";
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl p-8",
        toneMap[tone],
        className,
      )}
      style={{ minHeight }}
    >
      <div className="relative z-10 max-w-[55%]">
        {eyebrow && (
          <div className="text-xs font-bold uppercase tracking-widest opacity-80">
            {eyebrow}
          </div>
        )}
        <h2 className="mt-2 font-display text-4xl font-bold leading-tight tracking-tight lg:text-5xl">
          {title}
        </h2>
        <Button className="mt-6" size="lg" variant={ctaVariant}>
          {cta}
          <ArrowRightIcon />
        </Button>
      </div>
      {imageAlign === "right" && (
        <div className="pointer-events-none absolute right-6 top-1/2 hidden w-[45%] -translate-y-1/2 md:block">
          <ImageSlot ratio={imageRatio} rounded="2xl" tone={imageTone} />
        </div>
      )}
      {imageAlign === "bottom" && (
        <div className="relative z-0 mt-6">
          <ImageSlot ratio={imageRatio} rounded="xl" tone={imageTone} />
        </div>
      )}
    </div>
  );
}
