import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import {
  useListVendorProducts,
  useUpdateVendorProduct,
  useCreateVendorProduct,
  useDeleteVendorProduct,
  useListCategories,
  updateVendorProduct,
  deleteVendorProduct,
  getListVendorProductsQueryKey,
} from "@workspace/api-client-react";
import type { Product } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ImageUploader } from "@/components/shop/image-uploader";
import { VendorShell } from "@/components/vendor/vendor-nav";
import { cn } from "@/lib/utils";
import { EyeIcon, EyeOffIcon, PlusIcon, Trash2 } from "lucide-react";

const productsSearchSchema = z.object({ highlight: z.number().optional() });

export const Route = createFileRoute("/_shop/vendor/products")({
  head: () => ({
    meta: [{ title: "Products — Vendor dashboard — alkemart Ghana" }],
  }),
  validateSearch: productsSearchSchema,
  component: VendorProductsPage,
});

function pesewasToPrice(pesewas: number): string {
  return (pesewas / 100).toFixed(2);
}

function priceToPesewas(value: string): number {
  const num = Number.parseFloat(value);
  return Number.isFinite(num) ? Math.round(num * 100) : 0;
}

const PRODUCT_TAGS = [
  { value: "new", label: "New" },
  { value: "popular", label: "Popular" },
  { value: "best", label: "Best seller" },
  { value: "clearance", label: "Clearance" },
  { value: "rollback", label: "Rollback" },
] as const;

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) {
    return (
      <Badge variant="destructive" className="shrink-0 text-[11px]">
        Out of stock
      </Badge>
    );
  }
  if (stock <= 10) {
    return (
      <Badge className="shrink-0 bg-yellow-100 text-yellow-800 text-[11px] hover:bg-yellow-100">
        Low stock
      </Badge>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Bulk action toolbar
// ---------------------------------------------------------------------------

function BulkActionBar({
  selectedIds,
  onHide,
  onShow,
  onDelete,
  onClear,
  isBusy,
}: {
  selectedIds: Set<number>;
  onHide: () => void;
  onShow: () => void;
  onDelete: () => void;
  onClear: () => void;
  isBusy: boolean;
}) {
  const count = selectedIds.size;
  if (count === 0) return null;

  return (
    <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-md border border-border bg-background px-4 py-2.5 shadow-sm">
      <span className="text-sm font-medium">{count} selected</span>
      <div className="flex gap-2 ml-auto">
        <Button
          size="sm"
          variant="outline"
          onClick={onShow}
          disabled={isBusy}
          className="gap-1.5"
        >
          <EyeIcon className="h-3.5 w-3.5" />
          Show
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onHide}
          disabled={isBusy}
          className="gap-1.5"
        >
          <EyeOffIcon className="h-3.5 w-3.5" />
          Hide
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="sm"
              variant="destructive"
              disabled={isBusy}
              className="gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete {count}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {count} product{count !== 1 ? "s" : ""}?</AlertDialogTitle>
              <AlertDialogDescription>
                Products referenced by existing orders will be hidden from your store instead of permanently
                removed, so order history stays intact. This action cannot be undone for unreferenced products.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={onDelete}
              >
                Delete {count}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button size="sm" variant="ghost" onClick={onClear} disabled={isBusy} className="text-muted-foreground">
          Clear
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add product sheet
// ---------------------------------------------------------------------------

function AddProductSheet({ onCreated }: { onCreated: (productId: number) => void }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [categoryId, setCategoryId] = useState<string>("");
  const [tag, setTag] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [createdId, setCreatedId] = useState<number | null>(null);

  const { data: categories } = useListCategories();

  const createProduct = useCreateVendorProduct({
    mutation: {
      onSuccess: (product) => {
        toast.success(`"${product.title}" added to your store.`);
        queryClient.invalidateQueries({ queryKey: getListVendorProductsQueryKey() });
        setCreatedId(product.id);
        onCreated(product.id);
      },
      onError: () => {
        toast.error("Failed to create product. Please try again.");
      },
    },
  });

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = "Title is required.";
    const priceNum = Number.parseFloat(price);
    if (!price || !Number.isFinite(priceNum) || priceNum < 0) errs.price = "Enter a valid price (e.g. 49.99).";
    if (!categoryId) errs.categoryId = "Select a category.";
    const stockNum = Number.parseInt(stock, 10);
    if (stock !== "" && (!Number.isFinite(stockNum) || stockNum < 0)) errs.stock = "Stock must be 0 or more.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    createProduct.mutate({
      data: {
        title: title.trim(),
        brand: brand.trim() || undefined,
        pricePesewas: priceToPesewas(price),
        stock: Number.parseInt(stock, 10) || 0,
        categoryId: Number.parseInt(categoryId, 10),
        tag: tag || undefined,
      },
    });
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setTitle(""); setBrand(""); setPrice(""); setStock("0");
      setCategoryId(""); setTag(""); setErrors({}); setCreatedId(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <PlusIcon className="h-4 w-4" />
          Add product
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add new product</SheetTitle>
        </SheetHeader>

        {createdId ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Product created. Optionally add an image — it will appear after admin approval.
            </p>
            <ImageUploader
              targetType="product"
              targetId={createdId}
              label="Product image"
              onUploaded={() => queryClient.invalidateQueries({ queryKey: getListVendorProductsQueryKey() })}
            />
            <Button variant="outline" className="w-full" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="ap-title">Title *</Label>
              <Input id="ap-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Organic Basmati Rice 5kg" />
              {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ap-brand">Brand</Label>
              <Input id="ap-brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Gold Seal" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ap-price">Price (GH₵) *</Label>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-muted-foreground">GH₵</span>
                <Input id="ap-price" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" className="w-32" />
              </div>
              {errors.price && <p className="text-xs text-destructive">{errors.price}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ap-stock">Initial stock</Label>
              <Input id="ap-stock" type="number" min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)} className="w-24" />
              {errors.stock && <p className="text-xs text-destructive">{errors.stock}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Select a category…" /></SelectTrigger>
                <SelectContent>
                  {(categories ?? []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.categoryId && <p className="text-xs text-destructive">{errors.categoryId}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Tag</Label>
              <Select value={tag} onValueChange={setTag}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  {PRODUCT_TAGS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={createProduct.isPending}>
              {createProduct.isPending ? "Creating…" : "Create product"}
            </Button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Single-product editable row
// ---------------------------------------------------------------------------

function EditableRow({
  product,
  highlighted,
  softDeleted,
  selected,
  onToggleSelect,
  onDeleteAttempt,
}: {
  product: Product;
  highlighted?: boolean;
  softDeleted?: boolean;
  selected: boolean;
  onToggleSelect: (id: number) => void;
  onDeleteAttempt: (id: number) => void;
}) {
  const queryClient = useQueryClient();
  const rowRef = useRef<HTMLTableRowElement>(null);
  const [title, setTitle] = useState(product.title);
  const [price, setPrice] = useState(pesewasToPrice(product.pricePesewas));
  const [stock, setStock] = useState(String(product.stock));
  const [dirty, setDirty] = useState(false);
  const [showUploader, setShowUploader] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (highlighted) rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlighted]);

  const updateProduct = useUpdateVendorProduct({
    mutation: {
      onSuccess: () => {
        setDirty(false);
        queryClient.invalidateQueries({ queryKey: getListVendorProductsQueryKey() });
      },
    },
  });

  const deleteProduct = useDeleteVendorProduct({
    mutation: {
      onSuccess: () => {
        onDeleteAttempt(product.id);
        queryClient.invalidateQueries({ queryKey: getListVendorProductsQueryKey() });
      },
      onError: () => toast.error("Failed to delete product. Please try again."),
    },
  });

  function save() {
    updateProduct.mutate({
      id: product.id,
      data: { title, pricePesewas: priceToPesewas(price), stock: Number.parseInt(stock, 10) || 0 },
    });
  }

  function toggleActive(checked: boolean) {
    updateProduct.mutate({ id: product.id, data: { isActive: checked } });
  }

  const activeSwitch = (
    <div className="flex items-center gap-2">
      <Switch checked={product.isActive} onCheckedChange={toggleActive} disabled={updateProduct.isPending || softDeleted} />
      <span className="text-xs text-muted-foreground">{product.isActive ? "Active" : "Hidden"}</span>
    </div>
  );

  return (
    <>
      <TableRow
        ref={rowRef}
        className={cn(
          highlighted && "bg-primary/10 transition-colors",
          selected && "bg-primary/5",
        )}
      >
        {/* Checkbox */}
        <TableCell className="w-10 pr-0">
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect(product.id)}
            aria-label={`Select ${product.title}`}
          />
        </TableCell>
        <TableCell>
          <Input value={title} aria-label="Product title" onChange={(e) => { setTitle(e.target.value); setDirty(true); }} className="h-9 min-w-[220px]" />
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">GH₵</span>
            <Input value={price} aria-label="Product price" onChange={(e) => { setPrice(e.target.value); setDirty(true); }} className="h-9 w-24" />
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <Input value={stock} aria-label="Product stock" onChange={(e) => { setStock(e.target.value); setDirty(true); }} className="h-9 w-20" />
            <StockBadge stock={product.stock} />
          </div>
        </TableCell>
        <TableCell>
          {softDeleted ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild><div>{activeSwitch}</div></TooltipTrigger>
                <TooltipContent side="top" className="max-w-[220px] text-center">
                  This product is referenced by existing orders and can't be fully removed. It's been hidden instead.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : activeSwitch}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={!dirty || updateProduct.isPending} onClick={save}>
              {updateProduct.isPending ? "Saving…" : "Save"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowUploader((v) => !v)}>
              Image
            </Button>
            <Popover open={deleteOpen} onOpenChange={setDeleteOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" aria-label="Delete product" disabled={deleteProduct.isPending}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-4" side="left" align="center">
                <p className="text-sm font-medium mb-1">Delete product?</p>
                <p className="text-xs text-muted-foreground mb-3">
                  If this product appears in any orders it will be hidden instead of permanently removed.
                </p>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
                  <Button size="sm" variant="destructive" onClick={() => { setDeleteOpen(false); deleteProduct.mutate({ id: product.id }); }}>
                    Delete
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </TableCell>
      </TableRow>
      {showUploader && (
        <TableRow>
          <TableCell colSpan={COLSPAN} className="bg-surface/50">
            <ImageUploader
              targetType="product"
              targetId={product.id}
              currentImageUrl={product.imageUrl}
              label={`Image for ${product.title}`}
              onUploaded={() => queryClient.invalidateQueries({ queryKey: getListVendorProductsQueryKey() })}
            />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const COLSPAN = 6; // checkbox + title + price + stock + visibility + actions

function VendorProductsPage() {
  const search = Route.useSearch();
  const queryClient = useQueryClient();
  const { data: productData, isLoading: productsLoading } = useListVendorProducts();
  const products = productData?.items ?? [];

  const [attemptedDeleteIds, setAttemptedDeleteIds] = useState<Set<number>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  function handleDeleteAttempt(id: number) {
    setAttemptedDeleteIds((prev) => new Set(prev).add(id));
  }

  // Checkbox helpers -----------------------------------------------------------
  const allSelected = products.length > 0 && products.every((p) => selectedIds.has(p.id));
  const someSelected = products.some((p) => selectedIds.has(p.id));

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)));
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Bulk operations ------------------------------------------------------------
  async function bulkSetVisibility(isActive: boolean) {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(
      ids.map((id) => updateVendorProduct(id, { isActive })),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    await queryClient.invalidateQueries({ queryKey: getListVendorProductsQueryKey() });
    setBulkBusy(false);
    setSelectedIds(new Set());
    if (failed === 0) {
      toast.success(`${ids.length} product${ids.length !== 1 ? "s" : ""} ${isActive ? "shown" : "hidden"}.`);
    } else {
      toast.warning(`${ids.length - failed} succeeded, ${failed} failed.`);
    }
  }

  async function bulkDeleteSelected() {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(
      ids.map((id) => deleteVendorProduct(id)),
    );
    results.forEach((r, i) => {
      // A fulfilled void means deleted; we mark all as attempted so soft-deletes
      // get the tooltip treatment on the next render.
      if (r.status === "fulfilled") {
        setAttemptedDeleteIds((prev) => new Set(prev).add(ids[i]!));
      }
    });
    const failed = results.filter((r) => r.status === "rejected").length;
    await queryClient.invalidateQueries({ queryKey: getListVendorProductsQueryKey() });
    setBulkBusy(false);
    setSelectedIds(new Set());
    if (failed === 0) {
      toast.success(`${ids.length} product${ids.length !== 1 ? "s" : ""} removed.`);
    } else {
      toast.warning(`${ids.length - failed} removed, ${failed} failed.`);
    }
  }

  return (
    <VendorShell title="Products" description="Update title, price, stock or visibility for products in your store.">
      <div className="rounded-md border border-border p-6">
        {/* Bulk action bar */}
        <BulkActionBar
          selectedIds={selectedIds}
          onHide={() => void bulkSetVisibility(false)}
          onShow={() => void bulkSetVisibility(true)}
          onDelete={() => void bulkDeleteSelected()}
          onClear={() => setSelectedIds(new Set())}
          isBusy={bulkBusy}
        />

        {/* Header row */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {products.length > 0 ? `${products.length} product${products.length !== 1 ? "s" : ""}` : ""}
          </p>
          <AddProductSheet onCreated={() => {}} />
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 pr-0">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all products"
                    disabled={products.length === 0}
                  />
                </TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {productsLoading ? (
                <TableRow>
                  <TableCell colSpan={COLSPAN} className="py-8 text-center text-sm text-muted-foreground">
                    Loading products…
                  </TableCell>
                </TableRow>
              ) : products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLSPAN} className="py-8 text-center text-sm text-muted-foreground">
                    No products yet. Click <strong>Add product</strong> to create your first listing.
                  </TableCell>
                </TableRow>
              ) : (
                products.map((p) => (
                  <EditableRow
                    key={p.id}
                    product={p}
                    highlighted={search.highlight === p.id}
                    softDeleted={attemptedDeleteIds.has(p.id) && !p.isActive}
                    selected={selectedIds.has(p.id)}
                    onToggleSelect={toggleSelect}
                    onDeleteAttempt={handleDeleteAttempt}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </VendorShell>
  );
}
