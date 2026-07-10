import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAdminDisputes,
  useUpdateAdminDispute,
  useCreateAdminConversation,
  getListAdminDisputesQueryKey,
} from "@workspace/api-client-react";
import type { Dispute } from "@workspace/api-client-react";
import { AdminShell } from "@/components/admin/admin-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdminAccessBeforeLoad } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_shop/admin/disputes")({
  beforeLoad: requireAdminAccessBeforeLoad,
  head: () => ({ meta: [{ title: "Disputes — Admin panel" }] }),
  component: AdminDisputesPage,
});

const statusLabel: Record<Dispute["status"], string> = {
  open: "Open",
  resolved_buyer: "Resolved — buyer",
  resolved_seller: "Resolved — seller",
};

const paymentStatusLabel: Record<string, string> = {
  paid: "Paid",
  refunded: "Refunded",
  failed: "Failed",
  cod_pending: "Cash on delivery — pending",
};

function orderPaymentStatus(order: Dispute["order"]): string {
  if (!order) return "Unknown";
  const latest = order.paymentEvents[order.paymentEvents.length - 1];
  if (!latest) return order.paymentMethod === "cash_on_delivery" ? "Cash on delivery — pending" : "No payment recorded";
  return paymentStatusLabel[latest.type] ?? latest.type;
}

function centsToGhs(pesewas: number): string {
  return `GHS ${(pesewas / 100).toFixed(2)}`;
}

function DisputeOrderDetails({ order }: { order: Dispute["order"] }) {
  if (!order) {
    return <p className="text-sm text-muted-foreground">Linked order could not be found.</p>;
  }

  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>
          Order #{order.id} · <span className="font-medium">{centsToGhs(order.totalPesewas)}</span>
        </span>
        <Badge variant="outline">Payment: {orderPaymentStatus(order)}</Badge>
        {order.fulfillments.map((f) => (
          <Badge key={f.id} variant="outline">
            Fulfillment: {f.status}
          </Badge>
        ))}
      </div>
      <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
        {order.items.map((item) => (
          <li key={item.id}>
            {item.qty} × {item.titleSnapshot} ({centsToGhs(item.subtotalPesewas)})
          </li>
        ))}
      </ul>
    </div>
  );
}

function DisputeRow({ dispute }: { dispute: Dispute }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const updateDispute = useUpdateAdminDispute({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAdminDisputesQueryKey() }),
    },
  });

  const messageBuyer = useCreateAdminConversation({
    mutation: {
      onSuccess: (conversation) => navigate({ to: "/admin/inbox", search: { conversationId: conversation.id } }),
      onError: () => toast.error("Could not open a conversation with this buyer."),
    },
  });

  return (
    <>
      <TableRow className="[&>td]:border-b-0">
        <TableCell className="font-mono text-xs text-muted-foreground">#{dispute.orderId}</TableCell>
        <TableCell className="max-w-[280px]">{dispute.subject}</TableCell>
        <TableCell>
          <Select
            value={dispute.status}
            onValueChange={(status) => updateDispute.mutate({ id: dispute.id, data: { status: status as Dispute["status"] } })}
          >
            <SelectTrigger className="h-9 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">{statusLabel.open}</SelectItem>
              <SelectItem value="resolved_buyer">{statusLabel.resolved_buyer}</SelectItem>
              <SelectItem value="resolved_seller">{statusLabel.resolved_seller}</SelectItem>
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <Badge variant={dispute.status === "open" ? "destructive" : "secondary"}>{statusLabel[dispute.status]}</Badge>
        </TableCell>
        <TableCell className="text-right">
          {dispute.buyerUserId != null && (
            <Button
              size="sm"
              variant="outline"
              disabled={messageBuyer.isPending}
              onClick={() =>
                messageBuyer.mutate({ data: { userId: dispute.buyerUserId as number, subject: `Dispute: Order #${dispute.orderId}` } })
              }
            >
              Message buyer
            </Button>
          )}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={5} className="pt-0">
          <DisputeOrderDetails order={dispute.order ?? null} />
        </TableCell>
      </TableRow>
    </>
  );
}

function AdminDisputesPage() {
  const { data, isLoading } = useListAdminDisputes();
  const disputes = data?.items ?? [];

  return (
    <AdminShell
      title="Disputes"
      description="View/status-only queue — no refunds or payouts happen here (that lands with the escrow phase)."
    >
      <div className="overflow-x-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Update status</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  Loading disputes…
                </TableCell>
              </TableRow>
            ) : disputes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  No disputes right now — this queue will fill up once orders exist.
                </TableCell>
              </TableRow>
            ) : (
              disputes.map((d) => <DisputeRow key={d.id} dispute={d} />)
            )}
          </TableBody>
        </Table>
      </div>
    </AdminShell>
  );
}
