import { ImageSlot } from "./image-slot";
import { cn } from "@/lib/utils";

interface ColorSwatchProps {
  label: string;
  active?: boolean;
  tone?: "default" | "brand" | "accent";
  onClick?: () => void;
}

export function ColorSwatch({ label, active, tone = "default", onClick }: ColorSwatchProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 rounded-xl border-2 p-1 transition-colors",
        active ? "border-primary" : "border-border hover:border-primary/50",
      )}
    >
      <div className="w-16">
        <ImageSlot ratio={1} rounded="sm" tone={tone} />
      </div>
      <span className="text-[10px] font-semibold">{label}</span>
    </button>
  );
}
