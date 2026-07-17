import { Link } from "@tanstack/react-router";
import { CountdownTimerIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Logo } from "./logo";
import { LocationChip } from "./location-chip";
import { HeaderSearch } from "./header-search";
import { HeaderAccountMenu } from "./header-account-menu";
import { HeaderCartButton } from "./header-cart-button";
import { HeaderDepartmentNav } from "./header-department-nav";
import { NotificationBell } from "./notification-bell";
import { useAuth } from "@/lib/auth";
import { HEADER_TRUST_CHIPS } from "@/lib/commerce-content";
import { getMercurVendorUrl } from "@/lib/platform-features";

interface SiteHeaderProps {
  variant?: "default" | "minimal";
}

/**
 * Buyer chrome: logo, deliver-to, search, account, cart, departments.
 * Yellow/white/black palette unchanged — Ghana copy + IA only.
 */
export function SiteHeader({ variant = "default" }: SiteHeaderProps) {
  const { isAuthenticated } = useAuth();
  const sellerHubUrl = getMercurVendorUrl();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-header text-header-foreground shadow-sm">
      <div className="shop-shell py-2.5 md:py-3">
        <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:gap-3">
          <div className="flex items-center gap-2 md:contents">
            <Link to="/" className="shrink-0 self-center" aria-label="alkemart home">
              <Logo variant="onLight" />
            </Link>

            <LocationChip className="hidden shrink-0 self-center md:inline-flex" />

            <HeaderSearch className="hidden min-w-0 flex-1 self-center md:block" />

            <div className="ml-auto flex shrink-0 items-center gap-0.5 self-center sm:gap-1 md:ml-0">
              <Button
                variant="ghost"
                className="hidden h-11 gap-2 rounded-lg px-2 py-0 lg:inline-flex"
                asChild
              >
                <Link to="/orders">
                  <CountdownTimerIcon className="h-5 w-5 shrink-0" />
                  <span className="flex flex-col items-start leading-tight">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Returns &amp; more
                    </span>
                    <span className="text-sm font-semibold">Orders</span>
                  </span>
                </Link>
              </Button>

              {isAuthenticated && (
                <>
                  <NotificationBell />
                  <Separator orientation="vertical" className="mx-0.5 hidden h-8 sm:block" />
                </>
              )}

              <HeaderAccountMenu />
              <HeaderCartButton />
            </div>
          </div>

          <HeaderSearch className="w-full md:hidden" />
        </div>

        {/* Trust strip — mobile horizontal scroll; desktop wrap + sell link */}
        {variant === "default" && (
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-border/80 pt-2 text-xs text-muted-foreground">
            <ul
              className="flex min-w-0 flex-1 items-center gap-x-3 gap-y-1 overflow-x-auto no-scrollbar sm:flex-wrap"
              aria-label="Marketplace trust signals"
            >
              {HEADER_TRUST_CHIPS.map((chip) => (
                <li key={chip} className="inline-flex shrink-0 items-center gap-1.5">
                  <span
                    className="inline-block size-1.5 rounded-full bg-primary"
                    aria-hidden
                  />
                  <span className="font-medium text-foreground/85">{chip}</span>
                </li>
              ))}
            </ul>
            <a
              href={sellerHubUrl}
              className="hidden shrink-0 font-semibold text-foreground underline-offset-2 hover:underline sm:inline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Sell on alkemart
            </a>
          </div>
        )}
      </div>

      {variant === "default" && <HeaderDepartmentNav />}
    </header>
  );
}
