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
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        <Outlet />
        <div className="shop-shell py-4">
          <FeedbackBand />
        </div>
      </main>
      <SiteFooter />
      <div role="region" aria-label="Feedback">
        <SmileyFab />
      </div>
    </div>
  );
}
