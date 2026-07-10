import { useState, type ReactNode } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface LocationChipProps {
  primary?: string;
  secondary?: string;
  className?: string;
}

type Mode = "shipping" | "pickup" | "delivery";

const MODES: { id: Mode; label: string; icon: ReactNode }[] = [
  {
    id: "shipping",
    label: "Shipping",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]" aria-hidden="true">
        <path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z" strokeLinejoin="round" />
        <circle cx="7" cy="18" r="1.6" />
        <circle cx="17" cy="18" r="1.6" />
      </svg>
    ),
  },
  {
    id: "pickup",
    label: "Pickup",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]" aria-hidden="true">
        <path d="M4 10a8 8 0 0 1 16 0v6H4z" strokeLinejoin="round" />
        <circle cx="8" cy="18" r="1.6" />
        <circle cx="16" cy="18" r="1.6" />
      </svg>
    ),
  },
  {
    id: "delivery",
    label: "Delivery",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]" aria-hidden="true">
        <path d="M6 4h9l4 5v9H6z" strokeLinejoin="round" />
        <path d="M6 12h13" />
      </svg>
    ),
  },
];

export function LocationChip({
  className,
}: LocationChipProps) {
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("alkemart_fulfillment_mode") as Mode) || "pickup";
    }
    return "pickup";
  });

  const [address, setAddress] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("alkemart_delivery_address") || "Accra, Osu";
    }
    return "Accra, Osu";
  });

  const [store, setStore] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("alkemart_pickup_store") || "Accra Mall";
    }
    return "Accra Mall";
  });

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    localStorage.setItem("alkemart_fulfillment_mode", newMode);
  };

  const handleAddAddress = () => {
    const nextAddress = address === "Accra, Osu" ? "Airport City, Accra" : "Accra, Osu";
    setAddress(nextAddress);
    localStorage.setItem("alkemart_delivery_address", nextAddress);
  };

  const handleStoreChange = () => {
    const nextStore = store === "Accra Mall" ? "West Hills Mall" : "Accra Mall";
    setStore(nextStore);
    localStorage.setItem("alkemart_pickup_store", nextStore);
  };

  const displayPrimary = mode === "pickup" ? store : address;
  const displaySecondary = mode === "pickup" ? "Pickup Store" : "Delivery Address";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "hidden items-center gap-2 rounded-full bg-primary-hover px-3 py-1.5 text-left text-xs font-semibold hover:brightness-110 md:flex",
            className,
          )}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background/10">
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
              <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
            </svg>
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="text-[10px] font-bold uppercase tracking-wide opacity-80">
              Pickup or delivery?
            </span>
            <span className="truncate">
              {displayPrimary} <span className="opacity-70">• {displaySecondary}</span>
            </span>
          </span>
          <ChevronDownIcon className="h-4 w-4 shrink-0" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={12}
        className="w-[360px] rounded-md border-border p-5"
      >
        <div className="grid grid-cols-3 gap-3">
          {MODES.map((m) => {
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => handleModeChange(m.id)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-md border p-3 text-xs font-semibold transition",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full",
                    active ? "bg-primary-foreground/15" : "bg-muted",
                  )}
                >
                  {m.icon}
                </span>
                {m.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-md border border-border p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-muted">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
              </svg>
            </span>
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground">
                Add an address for shipping and delivery
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">{address}</div>
              <button
                type="button"
                onClick={handleAddAddress}
                className="mt-3 w-full rounded-full bg-primary py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-hover"
              >
                Toggle Address
              </button>
            </div>
          </div>
          <button
            type="button"
            className="mt-3 flex w-full items-center justify-between rounded-lg px-1 py-2 text-xs font-medium text-foreground hover:bg-muted"
          >
            <span className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[1.8]" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
              </svg>
              Ship to another country
            </span>
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleStoreChange}
          className="mt-3 flex w-full items-center justify-between rounded-md border border-border p-4 text-left hover:bg-muted"
        >
          <span className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-muted">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                <path d="M3 10 12 3l9 7v11h-6v-6h-6v6H3z" />
              </svg>
            </span>
            <span>
              <span className="block text-sm font-semibold text-foreground">
                {store} Supercentre
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Spintex Road, Accra
              </span>
            </span>
          </span>
          <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
        </button>
      </PopoverContent>
    </Popover>
  );
}
