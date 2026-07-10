import { PlusIcon, HeartIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ImageSlot } from "./image-slot";
import { PriceCents } from "./price-cents";
import { TextSkeleton } from "./text-skeleton";
import { cn } from "@/lib/utils";

interface FbtBundleProps {
  itemCount?: number;
  bundlePrice?: string;
  className?: string;
}

export function FbtBundle({
  itemCount = 3,
  bundlePrice = "304.97",
  className,
}: FbtBundleProps) {
  const items = Array.from({ length: itemCount });
  return (
    <div
      className={cn(
        "grid gap-6 rounded-md border border-border p-6 md:grid-cols-[1fr_260px] md:items-center",
        className,
      )}
    >
      <div className="flex items-start gap-2 overflow-x-auto">
        {items.map((_, i) => (
          <div key={`bundle-${i}`} className="flex items-center gap-2">
            <div className="w-[160px] space-y-2 shrink-0">
              <div className="relative">
                <ImageSlot ratio={1} rounded="md" tone={i === 0 ? "brand" : "default"} />
              </div>
              <PriceCents now={`${(i + 1) * 59}.00`} size="sm" />
              <TextSkeleton lines={2} widths={["100%", "70%"]} />
              <div className="flex items-center gap-2">
                <Checkbox defaultChecked id={`fbt-${i}`} />
                <label htmlFor={`fbt-${i}`} className="text-xs">
                  Include
                </label>
              </div>
            </div>
            {i < items.length - 1 && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-strong">
                <PlusIcon className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="rounded-md bg-surface p-5">
        <div className="text-xs text-muted-foreground">Bundle price</div>
        <PriceCents now={bundlePrice} size="xl" emphasis="deal" />
        <Button className="mt-3 w-full">Add {itemCount} items to cart</Button>
        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <HeartIcon className="h-3 w-3" /> Add all to registry
        </div>
      </div>
    </div>
  );
}
