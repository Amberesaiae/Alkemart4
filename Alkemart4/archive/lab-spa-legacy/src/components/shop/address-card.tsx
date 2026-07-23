import { cn } from "@/lib/utils";

interface Props {
  name?: string;
  line1?: string;
  city?: string;
  region?: string;
  digitalAddress?: string;
  phone?: string;
  isDefault?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  onRemove?: () => void;
  className?: string;
}

export function AddressCard({
  name = "Your name",
  line1 = "Address details coming soon",
  city,
  region,
  digitalAddress,
  phone,
  isDefault,
  selectable,
  selected,
  onSelect,
  onEdit,
  onRemove,
  className,
}: Props) {
  return (
    <div
      role={selectable ? "radio" : undefined}
      aria-checked={selectable ? selected : undefined}
      tabIndex={selectable ? 0 : undefined}
      onClick={selectable ? onSelect : undefined}
      onKeyDown={
        selectable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect?.();
              }
            }
          : undefined
      }
      className={cn(
        "rounded-md border border-border bg-background p-5",
        selectable && "cursor-pointer transition-colors hover:border-primary/60",
        selected && "border-primary ring-1 ring-primary",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{name}</div>
          <div className="mt-1 text-sm text-muted-foreground">{line1}</div>
          <div className="text-sm text-muted-foreground">{[city, region].filter(Boolean).join(", ")}</div>
          {digitalAddress && (
            <div className="mt-1 text-xs font-semibold text-primary">GPS: {digitalAddress}</div>
          )}
          <div className="mt-2 text-sm">{phone}</div>
        </div>
        {isDefault && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
            Default
          </span>
        )}
      </div>
      {(onEdit || onRemove) && (
        <div className="mt-4 flex gap-3 text-xs">
          {onEdit && (
            <button
              type="button"
              aria-label={`Edit address for ${name}`}
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="font-semibold text-primary underline"
            >
              Edit
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              aria-label={`Remove address for ${name}`}
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="font-semibold text-primary underline"
            >
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}
