import { useState } from "react"
import { CaretDown, CrosshairSimple } from "@phosphor-icons/react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui"
import {
  DELIVER_TO_AREAS,
  useDeliverTo,
  useDeliverToIsDetected,
} from "@/lib/deliver-to"
import { cn } from "@/lib/utils"
import { locatePrecisely } from "@/lib/geo"
import { nearestRegionByCoords } from "@alkemart/shared/ghana"

/**
 * "Deliver to" — the buyer's browsing context.
 *
 * Lives in the quiet context row below search. Location affects discovery,
 * but it must not interrupt the logo-to-search path in primary commerce chrome.
 *
 * Unset is a valid, quiet state. A marketplace that demands an address before
 * showing a single product loses the people who were only browsing, so this
 * reads "Set area" and waits rather than opening a modal on first visit.
 *
 * A first-time buyer in Ghana gets their region pre-filled from Cloudflare's
 * IP geo (see lib/deliver-to). That is labelled as detected rather than
 * presented as their choice, because quietly claiming to know where someone
 * lives — and being wrong — is worse than asking.
 */
export function DeliverToPicker({ className }: { className?: string }) {
  const [area, setArea] = useDeliverTo()
  const detected = useDeliverToIsDetected()
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState<string | null>(null)

  /**
   * On a Ghanaian mobile network the IP often resolves to the carrier's
   * gateway in Accra, so a buyer in Tamale is told "Greater Accra". GPS is the
   * only thing that fixes that — but only on an explicit tap: a cold prompt
   * gets denied and Chrome then suppresses it for good.
   */
  const useMyLocation = async () => {
    setLocating(true)
    setLocateError(null)
    try {
      const result = await locatePrecisely((lat, lon) => nearestRegionByCoords(lat, lon))
      if (result.ok) {
        setArea(result.region)
        return
      }
      setLocateError(
        result.reason === "denied"
          ? "Permission declined — pick your area below."
          : result.reason === "outside-ghana"
            ? "You seem to be outside Ghana — pick an area below."
            : "Could not read your location — pick your area below.",
      )
    } finally {
      setLocating(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-w-0 shrink items-center rounded-lg px-2 py-1 text-start ",
            "hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
          aria-label={
            area
              ? detected
                ? `Delivering to ${area}, detected from your connection. Change area`
                : `Delivering to ${area}. Change area`
              : "Choose delivery area"
          }
        >
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="text-[11px] font-medium text-muted-foreground leading-tight">
              Deliver to
            </span>
            <span className="flex min-w-0 items-center gap-1">
              <span className="truncate text-xs sm:text-sm font-bold text-foreground max-w-[100px] xs:max-w-[130px] sm:max-w-[150px] md:max-w-[170px]">
                {area ?? "Set area"}
              </span>
              <CaretDown size={13} weight="bold" className="shrink-0 text-muted-foreground" aria-hidden />
            </span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 min-w-[14rem] overflow-y-auto">
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            void useMyLocation()
          }}
          className="gap-2 font-bold"
        >
          <CrosshairSimple size={14} weight="bold" aria-hidden />
          {locating ? "Locating…" : "Use my location"}
        </DropdownMenuItem>
        {locateError ? (
          <p role="status" className="px-2 pb-1.5 text-[11px] text-muted-foreground">
            {locateError}
          </p>
        ) : null}
        <DropdownMenuSeparator />

        {detected ? (
          <>
            <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
              Detected from your connection
            </div>
            <DropdownMenuSeparator />
          </>
        ) : null}
        {area ? (
          <>
            <DropdownMenuItem onSelect={() => setArea(null)}>
              Show everywhere
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        {DELIVER_TO_AREAS.map((a) => (
          <DropdownMenuItem
            key={a.name}
            onSelect={() => setArea(a.name)}
            className={cn(area === a.name && "font-bold")}
          >
            {a.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
