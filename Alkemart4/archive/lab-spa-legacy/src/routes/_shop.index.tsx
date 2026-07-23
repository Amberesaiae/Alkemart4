import { createFileRoute } from "@tanstack/react-router";
import {
  CatalogEmptyHint,
  HomepageSectionList,
} from "@/components/shop/homepage-sections";
import { ShopPage } from "@/components/shop/shop-page";
import { DEFAULT_HOMEPAGE_SECTIONS } from "@/lib/homepage-fallback";
import { useListProducts } from "@/lib/hooks-products";

export const Route = createFileRoute("/_shop/")({
  head: () => ({
    meta: [
      { title: "alkemart Ghana — shop local vendors" },
      {
        name: "description",
        content:
          "Ghana multi-vendor marketplace lab. Shop local sellers, cash on delivery at checkout.",
      },
    ],
  }),
  component: HomePage,
});

/**
 * Homepage: static Ghana modules + live product rails.
 * Empty product rails collapse; one catalog empty hint when store has zero items.
 */
function HomePage() {
  const { data, isLoading, isError } = useListProducts({ limit: 1 });
  const catalogEmpty =
    !isLoading && !isError && (data?.total ?? data?.items?.length ?? 0) === 0;

  return (
    <ShopPage dense className="space-y-4 md:space-y-5">
      <h1 className="sr-only">alkemart Ghana</h1>
      <HomepageSectionList sections={DEFAULT_HOMEPAGE_SECTIONS as any} />
      {catalogEmpty ? <CatalogEmptyHint /> : null}
    </ShopPage>
  );
}
