import { createFileRoute, Outlet, useMatches } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/admin-nav";
import { AdminAnalyticsOverview } from "@/components/admin/admin-analytics-overview";
import { requireAdminAccessBeforeLoad } from "@/lib/auth";

export const Route = createFileRoute("/_shop/admin")({
  beforeLoad: requireAdminAccessBeforeLoad,
  head: () => ({
    meta: [{ title: "Admin panel — alkemart Ghana" }],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  const matches = useMatches();
  const isIndex = matches[matches.length - 1]?.routeId === "/_shop/admin";
  return isIndex ? <AdminHome /> : <Outlet />;
}

function AdminHome() {
  return (
    <AdminShell title="Overview" description="Marketplace-wide sales, orders, vendor performance and support health.">
      <AdminAnalyticsOverview />
    </AdminShell>
  );
}
