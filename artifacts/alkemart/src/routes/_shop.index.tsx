import { createFileRoute } from "@tanstack/react-router";
import { HomepageSectionList } from "@/components/shop/homepage-sections";
import { ShopPage } from "@/components/shop/shop-page";
import { DEFAULT_HOMEPAGE_SECTIONS } from "@/lib/homepage-fallback";

export const Route = createFileRoute("/_shop/")({
  head: () => ({
    meta: [
      { title: "alkemart Ghana" },
      { name: "description", content: "Shop products from vendors on alkemart Ghana." },
    ],
  }),
  component: HomePage,
});

/**
 * Homepage no longer depends on Express CMS stubs.
 * Static shell + Medusa product rails (empty until catalog ETL/admin).
 * When a Medusa homepage module ships, swap DEFAULT_HOMEPAGE_SECTIONS for API data.
 */
function HomePage() {
  return (
    <ShopPage dense className="space-y-4 md:space-y-5">
      <h1 className="sr-only">alkemart Ghana</h1>
      <HomepageSectionList sections={DEFAULT_HOMEPAGE_SECTIONS as any} />
    </ShopPage>
  );
}
