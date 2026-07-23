import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HeaderSearchProps {
  className?: string;
}

/**
 * Catalog search for the site header.
 * Input + submit sit in one flex row (no absolute positioning) so the
 * yellow button stays vertically centered with the field.
 */
export function HeaderSearch({ className }: HeaderSearchProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    navigate({
      to: "/browse/$slug",
      params: { slug: "search" },
      search: { search: q },
    });
  };

  return (
    <form
      onSubmit={handleSearchSubmit}
      className={cn("min-w-0", className)}
      role="search"
    >
      <div
        className={cn(
          "flex h-11 w-full items-center gap-1 rounded-full border border-border bg-muted pl-4 pr-1",
          "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40",
        )}
      >
        <input
          type="search"
          aria-label="Search catalog"
          placeholder="Search products, brands, categories"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={cn(
            "h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none",
            "placeholder:text-muted-foreground",
            // Native search decorations misalign padding in WebKit
            "appearance-none [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden",
          )}
        />
        <Button
          type="submit"
          size="icon"
          variant="accent"
          aria-label="Search"
          className="h-9 w-9 shrink-0 rounded-full shadow-none"
        >
          <MagnifyingGlassIcon className="size-5" />
        </Button>
      </div>
    </form>
  );
}
