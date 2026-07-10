import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from "@/components/ui/separator";
import { SectionHeader } from "@/components/shop/section-header";
import { ProductRail } from "@/components/shop/product-rail";
import { OrderRow } from "@/components/shop/order-row";
import { useListMyOrders, OrderStatus } from "@workspace/api-client-react";
import type { Order, OrderStatus as OrderStatusType } from "@workspace/api-client-react";
import { requireAuthBeforeLoad } from "@/lib/auth";

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

function pesewasToLabel(pesewas: number): string {
  return `GH₵${(pesewas / 100).toFixed(2)}`;
}

function rowStatus(status: OrderStatusType): "Delivered" | "In transit" | "Processing" | "Returned" {
  switch (status) {
    case OrderStatus.fulfilled:
      return "Delivered";
    case OrderStatus.confirmed:
      return "In transit";
    case OrderStatus.cancelled:
      return "Returned";
    case OrderStatus.pending:
    default:
      return "Processing";
  }
}

const tabToStatus: Record<string, OrderStatusType | null> = {
  all: null,
  delivered: OrderStatus.fulfilled,
  "in-transit": OrderStatus.confirmed,
  returned: OrderStatus.cancelled,
};

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
    <div className="mx-auto w-full max-w-[1400px] space-y-10 px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight">Your orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track deliveries, request returns and reorder your favourites.
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
            <div className="rounded-md border border-border bg-background p-8 text-center text-sm text-muted-foreground">
              Loading your orders…
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="rounded-md border border-border bg-background p-8 text-center text-sm text-muted-foreground">
              No orders found matching the filter criteria.
            </div>
          ) : (
            filteredOrders.map((o: Order) => (
              <OrderRow
                key={o.id}
                id={o.id}
                orderId={`AKM-${o.id}`}
                date={new Date(o.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                status={rowStatus(o.status)}
                total={pesewasToLabel(o.totalPesewas)}
                items={o.items.reduce((sum, item) => sum + item.qty, 0)}
              />
            ))
          )}
        </section>
        <aside className="space-y-6">
          <div className="rounded-md border border-border bg-background p-5">
            <h3 className="font-display text-lg font-bold">Delivery preferences</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Change default address, contactless drop-off and driver notes.
            </p>
          </div>
          <div>
            <SectionHeader title="Frequently reordered" linkTo="/browse/$slug" />
            <ProductRail count={3} columns={1} showAdd />
          </div>
        </aside>
      </div>

      <Separator />

      <section>
        <SectionHeader title="Buy again" linkTo="/browse/$slug" />
        <ProductRail count={6} columns={6} tag="best" showAdd />
      </section>
    </div>
  );
}
