import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { OrderRow } from "@/components/shop/order-row";
import { useListMyOrders, OrderStatus } from "@/lib/hooks-orders"
import type { AlkemartOrder } from "@/lib/hooks-orders"
import { requireAuthBeforeLoad } from "@/lib/auth";
import { formatOrderNumber, getLabDemoBanner } from "@/lib/platform-features";
import { pesewasToLabel } from "@/lib/money";
import { ShopPage } from "@/components/shop/shop-page";

export const Route = createFileRoute("/_shop/orders")({
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({
    meta: [
      { title: "Your orders — alkemart Ghana" },
      {
        name: "description",
        content: "Track deliveries, view receipts and reorder past purchases on alkemart Ghana.",
      },
      { property: "og:title", content: "Your orders — alkemart" },
      { property: "og:description", content: "Track and reorder past purchases." },
    ],
  }),
  component: OrdersPage,
});


function rowStatus(status: string): "Delivered" | "In transit" | "Processing" | "Returned" {
  switch (status) {
    case "fulfilled":
      return "Delivered";
    case "confirmed":
      return "In transit";
    case "cancelled":
      return "Returned";
    case "pending":
    default:
      return "Processing";
  }
}

const tabToStatus: Record<string, string | null> = {
  all: null,
  delivered: "fulfilled",
  "in-transit": "confirmed",
  returned: "cancelled",
}

function OrdersPage() {
  const { data, isLoading } = useListMyOrders();
  const orders = data?.items ?? [];

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [sort, setSort] = useState("recent");

  const filteredOrders = useMemo(() => {
    let result = orders.filter((o) => {
      const wantStatus = tabToStatus[activeTab];
      if (wantStatus && o.status !== wantStatus) return false;

      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          String(o.id).includes(q) ||
          rowStatus(o.status).toLowerCase().includes(q) ||
          o.items.some((item) => item.titleSnapshot.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      return true;
    });

    result = [...result];
    if (sort === "recent") {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sort === "price") {
      result.sort((a, b) => b.totalPesewas - a.totalPesewas);
    }

    return result;
  }, [orders, activeTab, searchQuery, sort]);

  return (
    <ShopPage dense>
      <div
        role="status"
        className="mb-4 rounded-lg border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"
      >
        {getLabDemoBanner()} Orders use lab reference labels until a formal receipt number is productized.
      </div>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight">Your orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lab order history from the marketplace API — not a production account ledger.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="search"
            aria-label="Search orders"
            placeholder="Search orders"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-64 rounded-full border border-input bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="h-10 w-40 rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most recent</SelectItem>
              <SelectItem value="price">By total</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      <ToggleGroup
        type="single"
        value={activeTab}
        onValueChange={(val) => val && setActiveTab(val)}
        className="justify-start gap-2"
      >
        {["all", "delivered", "in-transit", "returned"].map((v) => (
          <ToggleGroupItem
            key={v}
            value={v}
            className="rounded-full border border-border px-4 py-2 text-xs capitalize data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            {v.replace("-", " ")}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <section className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-md border border-border bg-background p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-28 rounded bg-muted" />
                    <div className="h-5 w-16 rounded-full bg-muted" />
                  </div>
                  <div className="h-3 w-36 rounded bg-muted" />
                  <div className="h-3 w-52 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="rounded-md border border-border bg-background p-12 text-center">
              <p className="text-sm font-medium text-foreground">No lab orders yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Place a cash-on-delivery order while signed in so it attaches to your account.
                Guest COD may not appear here.
              </p>
              <Link
                to="/browse/$slug"
                params={{ slug: "all" }}
                className="mt-4 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary-hover"
              >
                Browse the market
              </Link>
            </div>
          ) : (
            filteredOrders.map((o: AlkemartOrder) => (
              <OrderRow
                key={o.id}
                id={o.id}
                orderId={formatOrderNumber(o)}
                date={new Date(o.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                status={rowStatus(o.status)}
                total={pesewasToLabel(o.totalPesewas)}
                items={o.items.reduce((sum, item) => sum + item.qty, 0)}
                itemTitles={o.items.map((item) => item.titleSnapshot)}
              />
            ))
          )}
        </section>
        <aside className="space-y-6">
          <div className="rounded-md border border-border bg-background p-5">
            <h3 className="font-display text-lg font-bold">Delivery preferences</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Manage saved addresses from your account.
            </p>
            <Link
              to="/account/addresses"
              className="mt-3 inline-block text-xs font-bold text-link hover:underline"
            >
              Manage addresses
            </Link>
          </div>
        </aside>
      </div>
    </ShopPage>
  );
}
