import { Link, useNavigate } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "./user-avatar";
import { useAuth } from "@/lib/auth";
import { useLogout } from "@/lib/hooks-auth";
import { getMercurAdminUrl, getMercurVendorUrl } from "@/lib/platform-features";

/**
 * Buyer account menu. Seller/admin tools open Mercur externally — not SPA dual-home.
 */
export function HeaderAccountMenu() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const sellerHubUrl = getMercurVendorUrl();
  const adminHubUrl = getMercurAdminUrl();

  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email
    : null;

  const logout = useLogout();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-11 gap-2 rounded-lg px-2 py-0"
          aria-label={isAuthenticated ? "Account menu" : "Account — sign in or create account"}
        >
          <UserAvatar
            size="sm"
            name={displayName ?? undefined}
            isMember={isAuthenticated}
            guest
          />
          <span className="hidden flex-col items-start leading-tight sm:flex">
            <span className="text-[11px] font-medium text-muted-foreground">
              {isAuthenticated ? `Hi, ${user?.firstName ?? "there"}` : "Hello"}
            </span>
            <span className="text-sm font-semibold">Account</span>
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={10} className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-3 py-1">
            <UserAvatar
              size="md"
              name={displayName ?? undefined}
              isMember={isAuthenticated}
              guest
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {displayName ?? "Guest"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isAuthenticated ? "Signed in" : "Not signed in"}
              </p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {isAuthenticated ? (
          <DropdownMenuItem asChild>
            <Link to="/account" className="cursor-pointer font-semibold">
              Your account
            </Link>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem asChild>
            <Link to="/signin" className="cursor-pointer font-semibold">
              Sign in or create account
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuItem asChild>
          <Link to="/orders" className="cursor-pointer">
            Your orders
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <a
            href={sellerHubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer"
          >
            Sell on alkemart
          </a>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <a
            href={adminHubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer"
          >
            Admin hub
          </a>
        </DropdownMenuItem>

        {isAuthenticated && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={logout.isPending}
              onSelect={() => {
                logout.mutate(undefined, {
                  onSuccess: () => {
                    localStorage.removeItem("alkemart:auth_token");
                    navigate({ to: "/" });
                  },
                  onError: () => {
                    localStorage.removeItem("medusa_auth_token");
                    localStorage.removeItem("alkemart:auth_token");
                    navigate({ to: "/" });
                  },
                });
              }}
            >
              {logout.isPending ? "Signing out…" : "Sign out"}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
