import { PlayIcon } from "@radix-ui/react-icons";
import { ImageSlot } from "./image-slot";
import { PriceCents } from "./price-cents";
import { TextSkeleton } from "./text-skeleton";
import { cn } from "@/lib/utils";

interface VideoCardProps {
  handle?: string;
  price?: string;
  tone?: "default" | "brand" | "accent";
  className?: string;
}

export function VideoCard({
  handle = "@creator",
  price = "9.97",
  tone = "brand",
  className,
}: VideoCardProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative">
        <ImageSlot ratio={9 / 16} rounded="2xl" tone={tone} />
        <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-background/85 px-2.5 py-1 backdrop-blur-sm">
          <div className="h-6 w-6 rounded-full bg-primary/20 ring-1 ring-background" />
          <span className="text-[11px] font-semibold text-foreground">{handle}</span>
        </div>
        <div className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-foreground/70 text-background backdrop-blur-sm">
          <PlayIcon className="h-4 w-4" />
        </div>
      </div>
      <div className="rounded-xl border border-border p-2.5">
        <PriceCents now={price} size="sm" />
        <TextSkeleton className="mt-1.5" lines={2} widths={["100%", "60%"]} />
      </div>
    </div>
  );
}
