import { createFileRoute, Outlet, useMatches } from "@tanstack/react-router";
import { VendorShell } from "@/components/vendor/vendor-nav";
import { VendorAnalyticsOverview } from "@/components/vendor/vendor-analytics-overview";
import { requireVendorAccessBeforeLoad } from "@/lib/auth";

export const Route = createFileRoute("/_shop/vendor")({
  beforeLoad: requireVendorAccessBeforeLoad,
  head: () => ({
    meta: [{ title: "Vendor dashboard — alkemart Ghana" }],
  }),
  component: VendorLayout,
});

function VendorLayout() {
  const matches = useMatches();
  const isIndex = matches[matches.length - 1]?.routeId === "/_shop/vendor";
  return isIndex ? <VendorHome /> : <Outlet />;
}

function VendorHome() {
  return (
    <VendorShell title="Overview" description="Sales, orders and stock health for your store.">
      <VendorAnalyticsOverview />
    </VendorShell>
  );
}
