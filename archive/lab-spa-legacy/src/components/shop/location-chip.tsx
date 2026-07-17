import { useEffect, useMemo, useState } from "react";
import { ChevronDownIcon, HomeIcon, PersonIcon } from "@radix-ui/react-icons";
import { Link } from "@tanstack/react-router";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { useListMyAddresses } from "@/lib/hooks-cart";
import { useAuth } from "@/lib/auth";
import { PICKUP_STORES } from "@/lib/commerce-content";

interface LocationChipProps {
  className?: string;
}

type Mode = "shipping" | "pickup" | "delivery";

const MODE_KEY = "alkemart_fulfillment_mode";
const STORE_KEY = "alkemart_pickup_store";

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "delivery", label: "Deliver to", hint: "Your Ghana address" },
  { id: "pickup", label: "Pickup", hint: "Collect nearby" },
  { id: "shipping", label: "Ship", hint: "When offered by seller" },
];

function ModeIcon({ mode, className }: { mode: Mode; className?: string }) {
  if (mode === "pickup") {
    return (
      <svg viewBox="0 0 24 24" className={cn("fill-none stroke-current stroke-[1.8]", className)} aria-hidden>
        <path d="M4 10a8 8 0 0 1 16 0v6H4z" strokeLinejoin="round" />
        <path d="M9 16v2M15 16v2" strokeLinecap="round" />
      </svg>
    );
  }
  if (mode === "shipping") {
    return (
      <svg viewBox="0 0 24 24" className={cn("fill-none stroke-current stroke-[1.8]", className)} aria-hidden>
        <path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z" strokeLinejoin="round" />
        <circle cx="7" cy="18" r="1.5" />
        <circle cx="17" cy="18" r="1.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={cn("fill-none stroke-current stroke-[1.8]", className)} aria-hidden>
      <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Z" strokeLinejoin="round" />
      <circle cx="12" cy="9" r="2" />
    </svg>
  );
}

/**
 * Header fulfillment control — mode + destination.
 * Uses shadcn Popover / ToggleGroup / Button. Short mode label never truncates.
 */
export function LocationChip({ className }: LocationChipProps) {
  const { isAuthenticated } = useAuth();
  const { data: addresses } = useListMyAddresses({
    query: {
      enabled: isAuthenticated,
      retry: false,
      throwOnError: false,
      staleTime: 60_000,
    },
  });

  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === "undefined") return "delivery";
    const saved = localStorage.getItem(MODE_KEY) as Mode | null;
    return saved && MODES.some((m) => m.id === saved) ? saved : "delivery";
  });
  const [store, setStore] = useState(() => {
    if (typeof window === "undefined") return PICKUP_STORES[0] ?? "";
    return localStorage.getItem(STORE_KEY) || PICKUP_STORES[0] || "";
  });
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  const addressList = useMemo(() => addresses?.items ?? [], [addresses]);

  useEffect(() => {
    if (addressList.length && selectedAddressId == null) {
      setSelectedAddressId(addressList[0].id);
    }
  }, [addressList, selectedAddressId]);

  const selectedAddress = addressList.find((a) => a.id === selectedAddressId) ?? addressList[0];
  const modeMeta = MODES.find((m) => m.id === mode) ?? MODES[0];

  const handleModeChange = (value: string) => {
    if (!value) return;
    const next = value as Mode;
    setMode(next);
    localStorage.setItem(MODE_KEY, next);
  };

  /**
   * Destination line only — keep guest/empty copy short so it never ellipsizes.
   * Long street addresses may still truncate; full value is in title + popover.
   */
  const isPickup = mode === "pickup";
  let destination: string;
  let destinationMayTruncate = false;

  if (isPickup) {
    if (store) {
      destination = store;
      destinationMayTruncate = true;
    } else {
      destination = "Choose store";
    }
  } else if (selectedAddress) {
    destination =
      selectedAddress.city?.trim() ||
      selectedAddress.line1?.trim() ||
      selectedAddress.label?.trim() ||
      "Saved address";
    // Prefer city for the chip; full line lives in the popover. Only truncate if long.
    if (!selectedAddress.city?.trim() && selectedAddress.line1) {
      destination = selectedAddress.line1;
      destinationMayTruncate = true;
    }
  } else if (isAuthenticated) {
    destination = "Add address";
  } else {
    // Guest: show a place, not a second "Sign in" next to Account.
    destination = "Accra area";
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            // Override Button's default whitespace-nowrap so two lines layout cleanly.
            // Match search bar height (h-11) for vertical alignment in the header row.
            "hidden h-11 shrink-0 items-center justify-start gap-2 overflow-visible whitespace-normal rounded-lg border-border bg-card px-2.5 py-0 text-left shadow-none hover:bg-muted md:inline-flex",
            className,
          )}
          aria-label={`${modeMeta.label}: ${destination}`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-foreground">
            <ModeIcon mode={mode} className="h-4 w-4" />
          </span>
          <span className="flex flex-col items-start gap-0 leading-tight">
            <span className="text-[11px] font-medium text-muted-foreground">
              {modeMeta.label}
            </span>
            <span
              className={cn(
                "text-sm font-semibold text-foreground",
                // Only long addresses/stores may clip; short status copy never does.
                destinationMayTruncate && "max-w-[10rem] truncate",
              )}
              title={destinationMayTruncate ? destination : undefined}
            >
              {destination}
            </span>
          </span>
          <ChevronDownIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" sideOffset={10} className="w-[22rem] p-4 shadow-lg">
        <div className="mb-3">
          <p className="text-sm font-semibold">Where should we deliver?</p>
          <p className="text-xs text-muted-foreground">
            Delivery is the default in Ghana. Pickup only where a seller offers it.
          </p>
        </div>

        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={handleModeChange}
          variant="outline"
          className="flex w-full gap-2"
        >
          {MODES.map((m) => (
            <ToggleGroupItem
              key={m.id}
              value={m.id}
              aria-label={m.label}
              className={cn(
                "h-auto min-w-0 flex-1 flex-col gap-1 rounded-lg px-2 py-3 text-xs",
                "data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-foreground",
              )}
            >
              <ModeIcon mode={m.id} className="h-5 w-5" />
              <span className="font-semibold">{m.label}</span>
              <span className="text-[10px] font-normal text-muted-foreground">{m.hint}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <Separator className="my-4" />

        {mode === "pickup" ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Pickup store
              </p>
              {store ? <Badge variant="secondary">Selected</Badge> : null}
            </div>
            {PICKUP_STORES.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
                Pickup points are not listed yet. Use delivery to a saved address for now.
              </div>
            ) : (
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {PICKUP_STORES.map((s) => {
                  const active = store === s;
                  return (
                    <li key={s}>
                      <button
                        type="button"
                        onClick={() => {
                          setStore(s);
                          localStorage.setItem(STORE_KEY, s);
                        }}
                        className={cn(
                          "flex w-full items-start gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                          active
                            ? "border-primary bg-primary/10 font-semibold"
                            : "border-transparent hover:bg-muted",
                        )}
                      >
                        <HomeIcon className="mt-0.5 h-4 w-4 shrink-0" />
                        <span className="min-w-0 break-words">{s}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {mode === "shipping" ? "Shipping address" : "Delivery address"}
              </p>
              {selectedAddress ? <Badge variant="secondary">Selected</Badge> : null}
            </div>

            {!isAuthenticated && (
              <div className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
                <Button variant="default" size="sm" className="mb-2 w-full font-semibold" asChild>
                  <Link to="/signin">Sign in for delivery</Link>
                </Button>
                <p className="text-center text-xs">
                  Or{" "}
                  <Link to="/signin/create" className="font-semibold text-foreground underline-offset-2 hover:underline">
                    create an account
                  </Link>{" "}
                  to save addresses.
                </p>
              </div>
            )}

            {isAuthenticated && addressList.length === 0 && (
              <div className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
                No addresses yet.{" "}
                <Link
                  to="/account/addresses"
                  className="font-semibold text-foreground underline-offset-2 hover:underline"
                >
                  Add one
                </Link>
              </div>
            )}

            <ul className="max-h-48 space-y-1 overflow-y-auto">
              {addressList.map((a) => {
                const active = selectedAddressId === a.id;
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedAddressId(a.id)}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors",
                        active
                          ? "border-primary bg-primary/10"
                          : "border-transparent hover:bg-muted",
                      )}
                    >
                      <PersonIcon className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">
                          {a.label || a.fullName || "Address"}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {[a.line1, a.city].filter(Boolean).join(", ")}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {isAuthenticated && (
              <Button variant="link" className="h-auto px-0 text-xs font-semibold" asChild>
                <Link to="/account/addresses">Manage addresses</Link>
              </Button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
