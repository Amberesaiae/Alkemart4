import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAdminPromotions,
  useCreateAdminPromotion,
  useUpdateAdminPromotion,
  useDeleteAdminPromotion,
  getListAdminPromotionsQueryKey,
  PromotionDiscountType,
} from "@workspace/api-client-react";
import type { Promotion, PromotionDiscountType as PromotionDiscountTypeType } from "@workspace/api-client-react";
import { AdminShell } from "@/components/admin/admin-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdminAccessBeforeLoad } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_shop/admin/promotions")({
  beforeLoad: requireAdminAccessBeforeLoad,
  head: () => ({ meta: [{ title: "Promotions — Admin panel" }] }),
  component: AdminPromotionsPage,
});

function pesewasToPrice(pesewas: number): string {
  return (pesewas / 100).toFixed(2);
}

function formatDiscount(promotion: Promotion): string {
  return promotion.discountType === PromotionDiscountType.percentage
    ? `${promotion.value}%`
    : `GH₵${pesewasToPrice(promotion.value)}`;
}

function CreatePromotionForm() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<PromotionDiscountTypeType>(PromotionDiscountType.percentage);
  const [value, setValue] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const createPromotion = useCreateAdminPromotion({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminPromotionsQueryKey() });
        setCode("");
        setValue("");
        setMinOrder("");
        setUsageLimit("");
        setEndsAt("");
        toast.success("Promotion created.");
      },
      onError: () => toast.error("Could not create promotion. Check the code is unique and values are valid."),
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedValue = Number(value);
    if (!code.trim() || !Number.isFinite(parsedValue) || parsedValue <= 0) {
      toast.error("Enter a code and a positive discount value.");
      return;
    }
    createPromotion.mutate({
      data: {
        code: code.trim().toUpperCase(),
        discountType,
        value: discountType === PromotionDiscountType.percentage ? parsedValue : Math.round(parsedValue * 100),
        minOrderPesewas: minOrder.trim() ? Math.round(Number(minOrder) * 100) : undefined,
        usageLimit: usageLimit.trim() ? Number(usageLimit) : undefined,
        endsAt: endsAt.trim() ? new Date(endsAt).toISOString() : undefined,
      },
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-md border border-border p-6 sm:grid-cols-2 lg:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor="promo-code">Code</Label>
        <Input
          id="promo-code"
          placeholder="e.g. WELCOME10"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Discount type</Label>
        <Select value={discountType} onValueChange={(v) => setDiscountType(v as PromotionDiscountTypeType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={PromotionDiscountType.percentage}>Percentage</SelectItem>
            <SelectItem value={PromotionDiscountType.fixed}>Fixed amount</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="promo-value">
          {discountType === PromotionDiscountType.percentage ? "Percent off (1-100)" : "Amount off (GH₵)"}
        </Label>
        <Input
          id="promo-value"
          type="number"
          min={0}
          step={discountType === PromotionDiscountType.percentage ? 1 : 0.01}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="promo-min-order">Minimum order (GH₵, optional)</Label>
        <Input
          id="promo-min-order"
          type="number"
          min={0}
          step={0.01}
          value={minOrder}
          onChange={(e) => setMinOrder(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="promo-usage-limit">Usage limit (optional)</Label>
        <Input
          id="promo-usage-limit"
          type="number"
          min={1}
          value={usageLimit}
          onChange={(e) => setUsageLimit(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="promo-ends-at">Ends at (optional)</Label>
        <Input id="promo-ends-at" type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
      </div>

      <div className="sm:col-span-2 lg:col-span-3">
        <Button type="submit" disabled={createPromotion.isPending}>
          {createPromotion.isPending ? "Creating…" : "Create promotion"}
        </Button>
      </div>
    </form>
  );
}

function PromotionRow({ promotion }: { promotion: Promotion }) {
  const queryClient = useQueryClient();

  const updatePromotion = useUpdateAdminPromotion({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAdminPromotionsQueryKey() }),
    },
  });

  const deletePromotion = useDeleteAdminPromotion({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAdminPromotionsQueryKey() }),
      onError: () => toast.error("Could not delete this promotion."),
    },
  });

  return (
    <TableRow>
      <TableCell className="font-mono font-semibold">{promotion.code}</TableCell>
      <TableCell>{formatDiscount(promotion)}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {promotion.minOrderPesewas ? `GH₵${pesewasToPrice(promotion.minOrderPesewas)}` : "None"}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{promotion.usageLimit ?? "Unlimited"}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {promotion.endsAt ? new Date(promotion.endsAt).toLocaleDateString() : "No end date"}
      </TableCell>
      <TableCell>
        <Badge variant={promotion.isActive ? "secondary" : "outline"}>
          {promotion.isActive ? "Active" : "Inactive"}
        </Badge>
      </TableCell>
      <TableCell className="flex flex-wrap justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={updatePromotion.isPending}
          onClick={() => updatePromotion.mutate({ id: promotion.id, data: { isActive: !promotion.isActive } })}
        >
          {promotion.isActive ? "Deactivate" : "Activate"}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={deletePromotion.isPending}
          onClick={() => deletePromotion.mutate({ id: promotion.id })}
        >
          Delete
        </Button>
      </TableCell>
    </TableRow>
  );
}

function AdminPromotionsPage() {
  const { data, isLoading } = useListAdminPromotions();
  const promotions = data?.items ?? [];

  return (
    <AdminShell
      title="Promotions"
      description="Create code-based discounts buyers can apply at checkout, scoped by date range, minimum order, and usage limit."
    >
      <div className="space-y-6">
        <CreatePromotionForm />

        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Min order</TableHead>
                <TableHead>Usage limit</TableHead>
                <TableHead>Ends</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    Loading promotions…
                  </TableCell>
                </TableRow>
              ) : promotions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    No promotions yet.
                  </TableCell>
                </TableRow>
              ) : (
                promotions.map((p) => <PromotionRow key={p.id} promotion={p} />)
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminShell>
  );
}
