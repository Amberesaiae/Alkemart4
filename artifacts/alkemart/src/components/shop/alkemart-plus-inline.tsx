import { cn } from "@/lib/utils";

export function AlkemartPlusInline({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold text-primary", className)}>
      Save with
      <span className="inline-flex items-center rounded-sm bg-primary px-1 py-0.5 text-[9px] font-bold text-primary-foreground">
        alkemart+
      </span>
    </span>
  );
}
