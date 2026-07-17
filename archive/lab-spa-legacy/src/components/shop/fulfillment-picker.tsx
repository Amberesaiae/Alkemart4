import { cn } from "@/lib/utils";
import { gridColsClass, gridColsStyle } from "@/lib/grid-cols";

interface FulfillmentOption {
  key: string;
  label: string;
  sub: string;
  price?: string;
  disabled?: boolean;
}

interface FulfillmentPickerProps {
  options?: FulfillmentOption[];
  selected?: string;
  className?: string;
  columns?: 2 | 3;
  /**
   * Called when the buyer picks a different fulfillment option. When
   * omitted, the picker is read-only (e.g. shown as a preview/summary) and
   * its options are rendered as disabled controls rather than as buttons
   * that look actionable but silently do nothing for keyboard/screen
   * reader users.
   */
  onSelect?: (key: string) => void;
}

/** Honest defaults — no invented ETAs or fees until checkout pricing exists. */
const defaultOptions: FulfillmentOption[] = [
  { key: "shipping", label: "Shipping", sub: "ETA confirmed at checkout" },
  { key: "pickup", label: "Pickup", sub: "Ready windows vary by store" },
  { key: "delivery", label: "Delivery", sub: "Options depend on your address" },
];

export function FulfillmentPicker({
  options = defaultOptions,
  selected = "shipping",
  className,
  columns = 3,
  onSelect,
}: FulfillmentPickerProps) {
  const readOnly = !onSelect;
  return (
    <div
      className={cn("grid gap-2", gridColsClass(columns), className)}
      style={gridColsStyle(columns)}
      role={readOnly ? "group" : undefined}
      aria-label={readOnly ? "Fulfillment method (fixed for this order)" : undefined}
    >
      {options.map((o) => {
        const active = o.key === selected;
        const isDisabled = o.disabled || readOnly;
        return (
          <button
            key={o.key}
            type="button"
            disabled={isDisabled}
            aria-current={readOnly && active ? "true" : undefined}
            aria-pressed={!readOnly ? active : undefined}
            onClick={!readOnly ? () => onSelect(o.key) : undefined}
            aria-label={
              readOnly
                ? `${o.label}${active ? " (selected, not changeable here)" : " (unavailable)"}`
                : undefined
            }
            className={cn(
              "rounded-md border p-3 text-left transition-colors",
              active
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border hover:border-primary/50",
              isDisabled && !active && "opacity-40",
              readOnly && "cursor-default",
            )}
          >
            <div className="text-xs font-bold">{o.label}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">{o.sub}</div>
            {o.price && (
              <div className="mt-1 text-[11px] font-semibold text-success">{o.price}</div>
            )}
          </button>
        );
      })}
    </div>
  );
}
