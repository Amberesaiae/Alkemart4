import { PlusIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  mode?: "add" | "options";
  size?: "sm" | "md";
  className?: string;
}

export function AddToCartButton({ mode = "add", size = "sm", className }: Props) {
  if (mode === "options") {
    return (
      <Button
        size={size === "md" ? "default" : "sm"}
        variant="outline"
        className={cn("rounded-full border-foreground/20", className)}
      >
        Options
      </Button>
    );
  }
  return (
    <Button size={size === "md" ? "default" : "sm"} className={cn("rounded-full", className)}>
      <PlusIcon className="h-4 w-4" />
      Add
    </Button>
  );
}
