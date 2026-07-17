import { BellIcon } from "@radix-ui/react-icons"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

/**
 * Notifications UI — honest empty state until a Medusa notifications module
 * exists. Does not pretend to poll a backend.
 */
export function NotificationBell() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          className="relative hidden h-11 w-11 rounded-lg md:inline-flex"
        >
          <BellIcon className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={12} className="w-80 p-2">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <p className="px-2 py-4 text-center text-sm text-muted-foreground">
          Order updates will appear here when available. You can also check{" "}
          <span className="font-medium text-foreground">Purchase history</span>.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
