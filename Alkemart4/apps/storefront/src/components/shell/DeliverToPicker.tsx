import { CaretDown } from "@phosphor-icons/react"
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
 * Lives in the quiet context row below search. Location affects discovery,
 * but it must not interrupt the logo-to-search path in primary commerce chrome.
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
            "flex min-w-0 shrink items-center rounded-lg px-2 py-1 text-start transition",
            "hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
          aria-label={area ? `Delivering to ${area}. Change area` : "Choose delivery area"}
        >
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="text-[11px] font-medium text-muted-foreground leading-tight">
              Deliver to
            </span>
            <span className="flex min-w-0 items-center gap-1">
              <span className="truncate text-xs sm:text-sm font-bold text-foreground max-w-[100px] xs:max-w-[130px] sm:max-w-[150px] md:max-w-[170px]">
                {area ?? "Accra Central"}
              </span>
              <CaretDown size={13} weight="bold" className="shrink-0 text-muted-foreground" aria-hidden />
            </span>
          </span>
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
