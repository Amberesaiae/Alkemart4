import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAdminVendors,
  useUpdateAdminVendorStatus,
  useCreateAdminConversation,
  getListAdminVendorsQueryKey,
} from "@workspace/api-client-react";
import type { AdminVendor } from "@workspace/api-client-react";
import { AdminShell } from "@/components/admin/admin-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdminAccessBeforeLoad } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_shop/admin/vendors")({
  beforeLoad: requireAdminAccessBeforeLoad,
  head: () => ({ meta: [{ title: "Vendors — Admin panel" }] }),
  component: AdminVendorsPage,
});

function VendorRow({ vendor }: { vendor: AdminVendor }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const updateStatus = useUpdateAdminVendorStatus({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminVendorsQueryKey() });
      },
    },
  });

  const messageVendor = useCreateAdminConversation({
    mutation: {
      onSuccess: (conversation) => {
        navigate({ to: "/admin/inbox", search: { conversationId: conversation.id } });
      },
      onError: () => toast.error("Could not open a conversation with this vendor."),
    },
  });

  function toggleStatus() {
    updateStatus.mutate({ id: vendor.id, data: { status: vendor.status === "active" ? "suspended" : "active" } });
  }

  return (
    <TableRow>
      <TableCell className="font-semibold">{vendor.name}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{vendor.slug}</TableCell>
      <TableCell>
        <Badge variant={vendor.status === "active" ? "secondary" : "destructive"}>
          {vendor.status === "active" ? "Active" : "Suspended"}
        </Badge>
      </TableCell>
      <TableCell className="text-sm">
        {vendor.ratingCount > 0 ? `${(vendor.ratingAvgX100 / 100).toFixed(1)} (${vendor.ratingCount})` : "No reviews"}
      </TableCell>
      <TableCell className="text-sm">{(vendor.commissionBps / 100).toFixed(1)}%</TableCell>
      <TableCell className="flex flex-wrap justify-end gap-2">
        {vendor.ownerUserId != null && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              messageVendor.mutate({ data: { userId: vendor.ownerUserId as number, subject: `Vendor: ${vendor.name}` } })
            }
            disabled={messageVendor.isPending}
          >
            Message
          </Button>
        )}
        <Button
          size="sm"
          variant={vendor.status === "active" ? "destructive" : "default"}
          onClick={toggleStatus}
          disabled={updateStatus.isPending}
        >
          {vendor.status === "active" ? "Suspend" : "Reactivate"}
        </Button>
      </TableCell>
    </TableRow>
  );
}

function AdminVendorsPage() {
  const { data, isLoading } = useListAdminVendors();
  const vendors = data?.items ?? [];

  return (
    <AdminShell title="Vendors" description="View every vendor storefront. Suspend a vendor to hide their shop and products from buyers.">
      <div className="overflow-x-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Commission</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  Loading vendors…
                </TableCell>
              </TableRow>
            ) : vendors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No vendors yet.
                </TableCell>
              </TableRow>
            ) : (
              vendors.map((v) => <VendorRow key={v.id} vendor={v} />)
            )}
          </TableBody>
        </Table>
      </div>
    </AdminShell>
  );
}
