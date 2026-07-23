import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeftIcon, HeartIcon } from "@radix-ui/react-icons";
import { ShopPage } from "@/components/shop/shop-page";
import { useWishlistIds } from "@/hooks/use-wishlist";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_shop/account/lists")({
  head: () => ({
    meta: [
      { title: "Lists — alkemart Ghana" },
      {
        name: "description",
        content: "Saved for later items on alkemart Ghana.",
      },
    ],
  }),
  component: ListsPage,
});

/**
 * Lists / wishlist — local wishlist only (no fake product price grids).
 */
function ListsPage() {
  const savedIds = useWishlistIds().filter((id) => /^\d+$/.test(id));

  return (
    <ShopPage>
      <Link
        to="/account"
        className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon /> Back to account
      </Link>
      <header className="mt-4">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Your lists</h1>
        <p className="mt-1 text-muted-foreground">
          Items you save for later appear here. Full multi-list registries are coming soon.
        </p>
      </header>

      <section className="mt-10">
        <div className="shop-card flex flex-col items-start gap-4 p-6 md:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <HeartIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Saved for later</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {savedIds.length === 0
                ? "You haven’t saved any products yet. Tap the heart on a product to save it."
                : `You have ${savedIds.length} saved product${savedIds.length === 1 ? "" : "s"}.`}
            </p>
          </div>
          {savedIds.length > 0 && (
            <ul className="w-full divide-y divide-border rounded-lg border border-border">
              {savedIds.map((id) => (
                <li key={id}>
                  <Link
                    to="/ip/$id"
                    params={{ id }}
                    className="flex items-center justify-between px-4 py-3 text-sm font-semibold text-link hover:bg-muted"
                  >
                    View product #{id}
                    <span className="text-xs font-normal text-muted-foreground">Open</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Button asChild className="rounded-full font-bold">
            <Link to="/browse/$slug" params={{ slug: "all" }}>
              Continue shopping
            </Link>
          </Button>
        </div>
      </section>
    </ShopPage>
  );
}
