import { ImageIcon } from "@radix-ui/react-icons";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { cn } from "@/lib/utils";
import { getApiUrl } from "@/lib/api-url";

interface ImageSlotProps {
  ratio?: number;
  className?: string;
  imgClassName?: string;
  rounded?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  tone?: "default" | "brand" | "accent";
  src?: string | null;
  alt?: string;
}

const roundedMap = {
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  full: "rounded-full",
};

const toneMap = {
  default: "bg-gradient-to-br from-surface-strong/80 to-surface-strong text-muted-foreground/30 animate-pulse",
  brand: "bg-gradient-to-br from-secondary/10 to-secondary/25 text-primary/25 animate-pulse",
  accent: "bg-gradient-to-br from-accent/10 to-accent/20 text-accent-foreground/25 animate-pulse",
};

export function ImageSlot({
  ratio = 1,
  className,
  imgClassName,
  rounded = "md",
  tone = "default",
  src,
  alt = "",
}: ImageSlotProps) {
  return (
    <div className={cn("w-full", className)}>
      <AspectRatio ratio={ratio}>
        {src ? (
          <img
            src={getApiUrl(src)}
            alt={alt}
            className={cn("h-full w-full object-cover", roundedMap[rounded], imgClassName)}
          />
        ) : (
          <div
            className={cn(
              "flex h-full w-full items-center justify-center border border-border/60",
              roundedMap[rounded],
              toneMap[tone],
            )}
          >
            <ImageIcon className="h-6 w-6" />
          </div>
        )}
      </AspectRatio>
    </div>
  );
}
