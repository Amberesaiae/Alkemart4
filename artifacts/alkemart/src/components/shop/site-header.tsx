import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  MagnifyingGlassIcon,
  ChevronDownIcon,
  HeartIcon,
  CountdownTimerIcon,
  ChevronRightIcon,
} from "@radix-ui/react-icons";
import { useGetCart, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Logo } from "./logo";
import { LocationChip } from "./location-chip";
import { UserAvatar } from "./user-avatar";
import { NotificationBell } from "./notification-bell";
import { useAuth } from "@/lib/auth";

function pesewasToLabel(pesewas: number): string {
  return `GH₵${(pesewas / 100).toFixed(2)}`;
}

const groupedServices = [
  {
    category: "Health & Care",
    items: ["Pharmacy", "Vision & Optical", "Insurance & Benefits"],
  },
  {
    category: "Specialty Services",
    items: ["Custom Cakes", "Photo Services", "Auto Care Centre Services"],
  },
  {
    category: "Registry & Lists",
    items: ["Registry, Lists & Gifts", "Subscriptions"],
  },
  {
    category: "Financial & Business",
    items: ["Financial Services", "alkemart Business", "Protection, Home & Tech"],
  },
];

const departments = [
  "Grocery",
  "Fashion",
  "Electronics",
  "Home",
  "Patio & Garden",
  "Baby",
  "Toys",
  "Sports",
  "Auto",
  "Pharmacy",
  "Photo Center",
  "Deals",
];

interface SiteHeaderProps {
  variant?: "default" | "minimal";
}

export function SiteHeader({ variant = "default" }: SiteHeaderProps) {
  const { data: cart } = useGetCart();
  const { user, isAuthenticated, ability } = useAuth();
  const canAccessVendor = isAuthenticated && ability.can("update", "Product");
  const canAccessAdmin = isAuthenticated && ability.can("manage", "AdminPanel");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const itemCount = (cart?.items ?? []).reduce((sum: number, line) => sum + line.qty, 0);
  const subtotal = cart?.subtotalPesewas ?? 0;
  const displayName = user ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email : "Guest";

  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate({
        to: "/browse/$slug",
        params: { slug: "search" },
        search: { search: searchQuery.trim() },
      });
    }
  };

  const logout = useLogout({
    mutation: {
      onSuccess: () => {
        queryClient.setQueryData(getGetMeQueryKey(), { user: null });
        navigate({ to: "/" });
      },
    },
  });

  return (
    <header className="sticky top-0 z-40 w-full">
      <div className="bg-primary text-primary-foreground">
        <div className="mx-auto grid max-w-[1600px] grid-cols-[auto_auto_1fr_auto] items-center gap-3 px-6 py-3">
          <Link to="/" className="shrink-0">
            <Logo />
          </Link>

          <LocationChip />

          <form onSubmit={handleSearchSubmit} className="relative min-w-0">
            <input
              type="search"
              aria-label="Search catalog"
              placeholder="Search everything on alkemart, online and in-store"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 w-full rounded-full bg-background pl-5 pr-14 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              type="submit"
              aria-label="Search"
              className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary-hover"
            >
              <MagnifyingGlassIcon className="h-4 w-4" />
            </button>
          </form>

          <div className="flex items-center gap-1">
            <button
              type="button"
              className="hidden items-center gap-2 rounded-full px-3 py-2 text-xs hover:bg-primary-hover lg:flex"
            >
              <CountdownTimerIcon className="h-5 w-5 shrink-0" />
              <span className="flex flex-col items-start leading-tight">
                <span className="text-[10px] font-normal opacity-80">Reorder</span>
                <span className="font-semibold">My Items</span>
              </span>
            </button>

            {isAuthenticated && <NotificationBell />}

            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="hidden items-center gap-2 rounded-full px-3 py-2 text-xs hover:bg-primary-hover md:flex"
                >
                  <UserAvatar size="sm" name={displayName} isMember={isAuthenticated} />
                  <span className="flex flex-col items-start leading-tight">
                    <span className="text-[10px] font-normal opacity-80">
                      {isAuthenticated ? "Hi, " + (user?.firstName ?? "there") : "Sign In"}
                    </span>
                    <span className="font-semibold">Account</span>
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" sideOffset={12} className="w-72 rounded-2xl p-4">
                {isAuthenticated ? (
                  <>
                    <Link
                      to="/account"
                      className="block w-full rounded-full bg-primary py-2.5 text-center text-xs font-semibold text-primary-foreground hover:bg-primary-hover"
                    >
                      Your account
                    </Link>
                    <div className="my-3 h-px bg-border" />
                  </>
                ) : (
                  <>
                    <Link
                      to="/signin"
                      className="block w-full rounded-full bg-primary py-2.5 text-center text-xs font-semibold text-primary-foreground hover:bg-primary-hover"
                    >
                      Sign in or create account
                    </Link>
                    <div className="my-3 h-px bg-border" />
                  </>
                )}
                <nav className="flex flex-col text-sm">
                  <Link to="/orders" className="flex items-center gap-3 rounded-lg px-2 py-2 text-foreground hover:bg-muted">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[1.8]" aria-hidden="true">
                      <path d="M4 4h12l4 4v12H4z" strokeLinejoin="round" /><path d="M4 10h16" />
                    </svg>
                    Purchase history
                  </Link>
                  {canAccessVendor && (
                    <Link to="/vendor" className="flex items-center gap-3 rounded-lg px-2 py-2 text-foreground hover:bg-muted">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[1.8]" aria-hidden="true">
                        <path d="M3 9l9-6 9 6v11a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" strokeLinejoin="round" />
                      </svg>
                      Vendor dashboard
                    </Link>
                  )}
                  {canAccessAdmin && (
                    <Link to="/admin" className="flex items-center gap-3 rounded-lg px-2 py-2 text-foreground hover:bg-muted">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[1.8]" aria-hidden="true">
                        <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" strokeLinejoin="round" />
                      </svg>
                      Admin panel
                    </Link>
                  )}
                  <div className="flex items-center gap-3 rounded-lg px-2 py-2 text-foreground/60">
                    <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-accent text-[8px] font-bold text-accent-foreground">A+</span>
                    alkemart+
                  </div>
                  <div className="flex items-center gap-3 rounded-lg px-2 py-2 text-foreground/60">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[1.8]" aria-hidden="true">
                      <path d="M4 12a8 8 0 0 1 14-5l2-2v6h-6l2-2a5 5 0 0 0-9 3zM20 12a8 8 0 0 1-14 5l-2 2v-6h6l-2 2a5 5 0 0 0 9-3z" />
                    </svg>
                    Subscriptions
                  </div>
                  <div className="my-2 h-px bg-border" />
                  <div className="flex items-center justify-between rounded-lg px-2 py-2 text-foreground/60">
                    <span className="flex items-center gap-3">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[1.8]" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
                      </svg>
                      Language
                    </span>
                    <span className="text-xs text-muted-foreground">English</span>
                  </div>
                  {isAuthenticated && (
                    <>
                      <div className="my-2 h-px bg-border" />
                      <button
                        type="button"
                        onClick={() => logout.mutate()}
                        disabled={logout.isPending}
                        className="flex items-center gap-3 rounded-lg px-2 py-2 text-left text-foreground hover:bg-muted"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[1.8]" aria-hidden="true">
                          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M10 17l5-5-5-5M15 12H3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {logout.isPending ? "Signing out..." : "Sign out"}
                      </button>
                    </>
                  )}
                </nav>
              </PopoverContent>
            </Popover>

            <Link
              to="/cart"
              className="relative flex items-center gap-2 rounded-full bg-primary-hover px-4 py-2 text-xs font-semibold hover:brightness-110"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[2] shrink-0" aria-hidden="true">
                <path d="M3 3h2l2.4 12.4a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 2-1.5L22 8H6" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="10" cy="20" r="1.6" />
                <circle cx="17" cy="20" r="1.6" />
              </svg>
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-foreground">
                {itemCount}
              </span>
              <span className="hidden lg:inline">{pesewasToLabel(subtotal)}</span>
            </Link>
          </div>
        </div>

        {variant === "default" && (
          <div className="border-t border-primary-foreground/10">
            <div className="mx-auto flex max-w-[1600px] items-center gap-1 overflow-x-auto px-6 py-2 text-xs">
              {departments.map((d) => (
                <Link
                  key={d}
                  to="/browse/$slug"
                  params={{ slug: d.toLowerCase().replace(/\s+/g, "-").replace(/&/g, "and") }}
                  className="whitespace-nowrap rounded-full px-3 py-1.5 font-medium hover:bg-primary-hover"
                >
                  {d}
                </Link>
              ))}
              <div className="ml-auto flex items-center gap-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="whitespace-nowrap rounded-full px-3 py-1.5 hover:bg-primary-hover">
                      Services
                      <ChevronDownIcon className="ml-1 inline h-3 w-3" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" sideOffset={12} className="w-64 rounded-md p-3">
                    <div className="space-y-3">
                      {groupedServices.map((group, idx) => (
                        <div key={group.category} className="space-y-1">
                          {idx > 0 && <div className="border-t border-border my-1 pt-1" />}
                          <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                            {group.category}
                          </div>
                          <ul className="flex flex-col">
                            {group.items.map((s) => (
                              <li key={s}>
                                <div className="flex w-full items-center justify-between rounded-sm px-2 py-1 text-xs text-foreground/75 hover:bg-muted font-medium cursor-default">
                                  {s}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <div className="flex items-center whitespace-nowrap rounded-full px-3 py-1.5 text-primary-foreground/60">
                  <HeartIcon className="mr-1 inline h-4 w-4" />
                  Registry
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
