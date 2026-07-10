import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
} from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import { ImageSlot } from "./image-slot";

interface Props {
  eyebrow?: string;
  title?: string;
  cta?: string;
  imageUrl?: string | null;
}

export function DiscoveryHero({
  eyebrow = "Summer beauty refresh",
  title = "New & trending",
  cta = "Shop now",
  imageUrl,
}: Props) {
  return (
    <div className="relative overflow-hidden rounded-md bg-secondary" style={{ minHeight: 380 }}>
      <div className="grid h-full grid-cols-[1fr_1.4fr] items-center gap-6 p-10">
        <div className="max-w-md">
          <div className="text-sm font-semibold text-primary">{eyebrow}</div>
          <h2 className="mt-3 font-display text-5xl font-bold leading-[1] tracking-tight text-primary md:text-6xl">
            {title}
          </h2>
          <Button size="lg" variant="outline" className="mt-8 rounded-full border-primary bg-background">
            {cta}
          </Button>
        </div>
        <ImageSlot ratio={16 / 9} rounded="md" tone="brand" src={imageUrl} alt={title} />
      </div>
      <div className="absolute right-6 top-6 flex items-center gap-2 rounded-full bg-background/80 p-1 backdrop-blur">
        {[
          { Icon: ChevronLeftIcon, label: "Previous slide" },
          { Icon: PauseIcon, label: "Pause slideshow" },
          { Icon: ChevronRightIcon, label: "Next slide" },
        ].map(({ Icon, label }, i) => (
          <button
            key={i}
            type="button"
            aria-label={label}
            className="flex h-8 w-8 items-center justify-center rounded-full text-foreground hover:bg-muted"
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}
