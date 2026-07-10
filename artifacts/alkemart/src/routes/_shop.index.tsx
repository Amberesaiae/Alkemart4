import { createFileRoute } from "@tanstack/react-router";
import { useListHomepageSections } from "@workspace/api-client-react";
import { HomepageSectionList } from "@/components/shop/homepage-sections";

export const Route = createFileRoute("/_shop/")({
  head: () => ({
    meta: [
      { title: "alkemart Ghana — Everyday low prices, delivered as fast as 1 hour" },
      {
        name: "description",
        content:
          "Rollbacks, flash sales and same-hour delivery on groceries, electronics, home and fashion across Accra and Ghana.",
      },
      { property: "og:title", content: "alkemart Ghana — Everyday low prices" },
      { property: "og:description", content: "Same-hour delivery in Accra. Rollbacks and flash sales daily." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { data } = useListHomepageSections();

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-10 px-6 py-6">
      <h1 className="sr-only">alkemart Ghana — Everyday low prices, delivered fast</h1>
      <HomepageSectionList sections={data?.items ?? []} />
    </div>
  );
}
