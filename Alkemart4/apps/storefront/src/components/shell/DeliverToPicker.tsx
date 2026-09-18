import { CaretDown, MapPin } from "@phosphor-icons/react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui"
import { DELIVER_TO_AREAS, useDeliverTo } from "@/lib/deliver-to"
import { cn } from "@/lib/utils"

/**
 * "Deliver to" — the buyer's browsing context.
 *
 * Sits beside search because where something is going changes what is worth
 * showing: which shops are near, which arrive soonest, which shelves apply.
 *
 * Unset is a valid, quiet state. A marketplace that demands an address before
 * showing a single product loses the people who were only browsing, so this
 * reads "Set area" and waits rather than opening a modal on first visit.
 */
export function DeliverToPicker({ className }: { className?: string }) {
  const [area, setArea] = useDeliverTo()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-start",
            "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
          aria-label={area ? `Delivering to ${area}. Change area` : "Choose delivery area"}
        >
          <MapPin size={18} weight={area ? "fill" : "regular"} className="shrink-0 text-muted-foreground" aria-hidden />
          <span className="hidden min-w-0 flex-col leading-tight sm:flex">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Deliver to
            </span>
            <span className="truncate text-xs font-bold">{area ?? "Set area"}</span>
          </span>
          <CaretDown size={12} weight="bold" className="hidden shrink-0 text-muted-foreground sm:block" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 min-w-[14rem] overflow-y-auto">
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
