import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDownIcon, HeartIcon } from "@radix-ui/react-icons";
import { useListCategories } from "@/lib/hooks-products";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  SITE_DEPARTMENTS,
  SITE_SERVICE_GROUPS,
  labelToSlug,
} from "@/lib/commerce-content";
import { MerchLink } from "@/lib/nav-link";
import { getMercurVendorUrl } from "@/lib/platform-features";

/** Secondary department strip under the main header bar. */
export function HeaderDepartmentNav() {
  const { data: categories } = useListCategories();
  const sellerHubUrl = getMercurVendorUrl();

  const departmentNav = useMemo(() => {
    const list = Array.isArray(categories) ? categories : [];
    const tops = list.filter((c) => !c.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
    if (tops.length > 0) {
      return tops.slice(0, 14).map((c) => ({ label: c.name, slug: c.slug }));
    }
    return SITE_DEPARTMENTS.map((label) => ({ label, slug: labelToSlug(label) }));
  }, [categories]);

  return (
    <div className="border-t border-border bg-muted/50">
      <div className="shop-shell flex items-center gap-1 py-1">
        <nav
          className="flex w-full items-center gap-0.5 overflow-x-auto py-0.5 no-scrollbar"
          aria-label="Departments"
        >
          {departmentNav.map((d) => (
            <Button
              key={d.slug}
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 rounded-full px-3 text-sm font-semibold"
              asChild
            >
              <Link to="/browse/$slug" params={{ slug: d.slug }}>
                {d.label}
              </Link>
            </Button>
          ))}

          <div className="ml-auto hidden shrink-0 items-center gap-0.5 md:flex">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 rounded-full px-3 text-sm font-semibold"
              asChild
            >
              <a href={sellerHubUrl} target="_blank" rel="noopener noreferrer">
                Sell
              </a>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-full px-3 text-sm font-semibold"
                >
                  More
                  <ChevronDownIcon className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className="w-56">
                {SITE_SERVICE_GROUPS.map((group, idx) => (
                  <div key={group.category}>
                    {idx > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {group.category}
                    </DropdownMenuLabel>
                    {group.items.map((s) => (
                      <DropdownMenuItem key={s.label} asChild>
                        <MerchLink to={s.to} className="cursor-pointer">
                          {s.label}
                        </MerchLink>
                      </DropdownMenuItem>
                    ))}
                  </div>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/account/lists" className="cursor-pointer">
                    <HeartIcon className="mr-2 h-4 w-4" />
                    Lists
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/help" className="cursor-pointer">
                    Help
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </nav>
      </div>
    </div>
  );
}
