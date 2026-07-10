import { MinusIcon, PlusIcon } from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";

interface QtyStepperProps {
  value?: number;
  className?: string;
  onDecrease?: () => void;
  onIncrease?: () => void;
  disabled?: boolean;
}

export function QtyStepper({ value = 1, className, onDecrease, onIncrease, disabled = false }: QtyStepperProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-background px-1 py-1",
        className,
      )}
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={onDecrease}
        disabled={disabled}
        className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-surface disabled:opacity-50"
      >
        <MinusIcon className="h-4 w-4" />
      </button>
      <span className="min-w-6 text-center text-sm font-semibold tabular-nums">
        {value}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={onIncrease}
        disabled={disabled}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
      >
        <PlusIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
