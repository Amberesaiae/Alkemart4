import { Outlet, createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/shop/site-header";
import { SiteFooter } from "@/components/shop/site-footer";
import { FeedbackBand } from "@/components/shop/feedback-band";
import { SmileyFab } from "@/components/shop/smiley-fab";

export const Route = createFileRoute("/_shop")({
  component: ShopLayout,
});

function ShopLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <Outlet />
        <FeedbackBand />
      </main>
      <SiteFooter />
      <div role="region" aria-label="Feedback">
        <SmileyFab />
      </div>
    </div>
  );
}
