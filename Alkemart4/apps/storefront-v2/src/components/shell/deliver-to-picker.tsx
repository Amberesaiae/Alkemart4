import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon, Location01Icon, Navigation03Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { deliverToAreas, useDeliverTo, useDeliverToIsDetected } from "@/lib/deliver-to"
import { locatePrecisely } from "@/lib/geo"
import { useMarket } from "@/lib/market"
import { writePin } from "@/lib/nearby"
import { cn } from "@/lib/utils"

/**
 * "Deliver to" — a browsing context (sorts shops, labels delivery), never an
 * address. Precise location runs only on an explicit tap.
 */
export function DeliverToPicker({ className, compact }: { className?: string; compact?: boolean }) {
  const market = useMarket()
  const [area, setArea] = useDeliverTo()
  const detected = useDeliverToIsDetected()
  const [open, setOpen] = useState(false)
  const [locating, setLocating] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  async function useMyLocation() {
    setLocating(true)
    setNote(null)
    const r = await locatePrecisely(market.nearestRegion)
    setLocating(false)
    if (r.ok) {
      writePin({ lat: r.lat, lng: r.lng })
      setArea(r.region)
      setOpen(false)
    } else {
      setNote(
        r.reason === "denied"
          ? "Location permission was declined."
          : r.reason === "outside-market"
            ? `That location is outside ${market.name}.`
            : "Couldn't get your location right now.",
      )
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-left text-sm hover:bg-foreground/5",
            className,
          )}
        >
          <HugeiconsIcon icon={Location01Icon} className="size-[18px] shrink-0" />
          <span className="min-w-0 leading-tight">
            {!compact ? <span className="block text-xs opacity-75">Deliver to</span> : null}
            <span className="block max-w-36 truncate font-semibold">
              {area ?? `All of ${market.name}`}
            </span>
          </span>
          <HugeiconsIcon icon={ArrowDown01Icon} className="size-4 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 rounded-3xl p-2">
        <div className="p-2">
          <p className="font-semibold">Where should we deliver?</p>
          <p className="text-xs text-muted-foreground">
            {detected && area ? `We guessed ${area} from your connection. ` : ""}Shops near you show first.
          </p>
        </div>
        <Button variant="outline" className="mx-2 mb-2 w-[calc(100%-1rem)]" onClick={useMyLocation} disabled={locating}>
          <HugeiconsIcon icon={Navigation03Icon} data-icon="inline-start" />
          {locating ? "Finding you…" : "Use my location"}
        </Button>
        {note ? <p className="px-3 pb-2 text-xs text-destructive">{note}</p> : null}
        <ScrollArea className="h-64">
          <ul className="space-y-0.5 p-1">
            {[{ name: null as string | null }, ...deliverToAreas()].map((a) => {
              const active = (a.name ?? null) === area
              return (
                <li key={a.name ?? "_all"}>
                  <button
                    type="button"
                    onClick={() => {
                      setArea(a.name)
                      if (!a.name) writePin(null)
                      setOpen(false)
                    }}
                    className="flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm hover:bg-muted"
                  >
                    {a.name ?? `All of ${market.name}`}
                    {active ? <HugeiconsIcon icon={Tick02Icon} className="size-4" /> : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
