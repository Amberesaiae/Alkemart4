import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAdminImages,
  useApproveAdminImage,
  useRejectAdminImage,
  getListAdminImagesQueryKey,
} from "@workspace/api-client-react";
import type { Image, ImageStatus } from "@workspace/api-client-react";
import { AdminShell } from "@/components/admin/admin-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ImageSlot } from "@/components/shop/image-slot";
import { toast } from "sonner";

export const Route = createFileRoute("/_shop/admin/images")({
  head: () => ({ meta: [{ title: "Image moderation — Admin panel" }] }),
  component: AdminImagesPage,
});

const STATUS_FILTERS: { label: string; value: ImageStatus | undefined }[] = [
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "All", value: undefined },
];

const statusVariant: Record<ImageStatus, "default" | "secondary" | "destructive"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
};

function ImageRow({ image }: { image: Image }) {
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListAdminImagesQueryKey() });

  const approve = useApproveAdminImage({
    mutation: {
      onSuccess: () => {
        toast.success("Image approved.");
        invalidate();
      },
      onError: () => toast.error("Could not approve image."),
    },
  });

  const reject = useRejectAdminImage({
    mutation: {
      onSuccess: () => {
        toast.success("Image rejected.");
        setRejecting(false);
        setReason("");
        invalidate();
      },
      onError: () => toast.error("Could not reject image."),
    },
  });

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-background p-4 sm:flex-row sm:items-start">
      <div className="w-32 shrink-0">
        <ImageSlot ratio={1} rounded="md" tone="brand" src={image.imageUrl} alt="" />
      </div>
      <div className="flex-1 space-y-1 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant[image.status]}>{image.status}</Badge>
          <span className="font-semibold">{image.targetType}</span>
          {image.targetId != null && <span className="text-muted-foreground">#{image.targetId}</span>}
        </div>
        <div className="text-xs text-muted-foreground">
          {image.width && image.height ? `${image.width}×${image.height}px` : "Unknown dimensions"} ·{" "}
          {image.sizeBytes ? `${(image.sizeBytes / 1024).toFixed(0)}KB` : "Unknown size"} ·{" "}
          {image.contentType ?? "unknown type"}
        </div>
        {image.rejectionReason && (
          <div className="text-xs text-destructive">Reason: {image.rejectionReason}</div>
        )}
        <div className="text-xs text-muted-foreground">
          Uploaded {new Date(image.createdAt).toLocaleString()}
        </div>
      </div>
      {image.status === "pending" && (
        <div className="flex shrink-0 flex-col gap-2 sm:w-56">
          <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate({ id: image.id })}>
            {approve.isPending ? "Approving…" : "Approve"}
          </Button>
          {rejecting ? (
            <div className="space-y-2">
              <Input
                placeholder="Reason for rejection"
                aria-label="Reason for rejection"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="h-9"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={!reason.trim() || reject.isPending}
                  onClick={() => reject.mutate({ id: image.id, data: { reason: reason.trim() } })}
                >
                  {reject.isPending ? "Rejecting…" : "Confirm reject"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setRejecting(true)}>
              Reject
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function AdminImagesPage() {
  const [status, setStatus] = useState<ImageStatus | undefined>("pending");
  const { data, isLoading } = useListAdminImages({ status });
  const items = data?.items ?? [];

  return (
    <AdminShell
      title="Image moderation"
      description="Review vendor and admin image uploads that passed automated technical checks."
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f.label}
            size="sm"
            variant={status === f.value ? "default" : "outline"}
            onClick={() => setStatus(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading images…</p>
      ) : items.length === 0 ? (
        <p className="rounded-md border border-border p-8 text-center text-sm text-muted-foreground">
          No images in this queue.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((image) => (
            <ImageRow key={image.id} image={image} />
          ))}
        </div>
      )}
    </AdminShell>
  );
}
