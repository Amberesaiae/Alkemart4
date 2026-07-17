import { ChevronDownIcon } from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";
import { MARKETS, marketByCode, type MarketCode } from "@/lib/markets";

interface CountrySelectProps {
  value?: string;
  onChange?: (code: MarketCode) => void;
  disabled?: boolean;
  className?: string;
  /** When true, only markets marked live (currently Ghana). */
  liveOnly?: boolean;
}

/**
 * Real country/market selector. Value is ISO country code (GH, NG, …).
 */
export function CountrySelect({
  value = "GH",
  onChange,
  disabled,
  className,
  liveOnly = false,
}: CountrySelectProps) {
  const options = liveOnly ? MARKETS.filter((m) => m.live) : MARKETS;
  const selected = marketByCode(value);

  return (
    <div className={cn("relative", className)}>
      <select
        aria-label="Country"
        disabled={disabled}
        value={selected.code}
        onChange={(e) => onChange?.(e.target.value as MarketCode)}
        className={cn(
          "h-12 w-full appearance-none rounded-md border border-input bg-background py-2 pl-3 pr-10 text-sm font-semibold",
          "focus:outline-none focus:ring-2 focus:ring-ring",
          disabled && "opacity-60",
        )}
      >
        {options.map((m) => (
          <option key={m.code} value={m.code}>
            {m.name} ({m.dialCode}){!m.live ? " — coming soon" : ""}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <p className="mt-1 text-[11px] text-muted-foreground">
        Currency for this market: {selected.currencySymbol} ({selected.currency})
        {!selected.live && " — catalog checkout remains GHS until this market is enabled"}
      </p>
    </div>
  );
}
