import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  useListVendorProducts,
  useUpdateVendorProduct,
  getListVendorProductsQueryKey,
} from "@workspace/api-client-react";
import type { Product } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ImageUploader } from "@/components/shop/image-uploader";
import { VendorShell } from "@/components/vendor/vendor-nav";
import { cn } from "@/lib/utils";

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

function EditableRow({ product, highlighted }: { product: Product; highlighted?: boolean }) {
  const queryClient = useQueryClient();
  const rowRef = useRef<HTMLTableRowElement>(null);
  const [title, setTitle] = useState(product.title);
  const [price, setPrice] = useState(pesewasToPrice(product.pricePesewas));
  const [stock, setStock] = useState(String(product.stock));
  const [dirty, setDirty] = useState(false);
  const [showUploader, setShowUploader] = useState(false);

  useEffect(() => {
    if (highlighted) {
      rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlighted]);

  const updateProduct = useUpdateVendorProduct({
    mutation: {
      onSuccess: () => {
        setDirty(false);
        queryClient.invalidateQueries({ queryKey: getListVendorProductsQueryKey() });
      },
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

  return (
    <>
      <TableRow ref={rowRef} className={cn(highlighted && "bg-primary/10 transition-colors")}>
        <TableCell>
          <Input
            value={title}
            aria-label="Product title"
            onChange={(e) => {
              setTitle(e.target.value);
              setDirty(true);
            }}
            className="h-9 min-w-[220px]"
          />
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">GH₵</span>
            <Input
              value={price}
              aria-label="Product price"
              onChange={(e) => {
                setPrice(e.target.value);
                setDirty(true);
              }}
              className="h-9 w-24"
            />
          </div>
        </TableCell>
        <TableCell>
          <Input
            value={stock}
            aria-label="Product stock"
            onChange={(e) => {
              setStock(e.target.value);
              setDirty(true);
            }}
            className="h-9 w-20"
          />
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <Switch checked={product.isActive} onCheckedChange={toggleActive} disabled={updateProduct.isPending} />
            <span className="text-xs text-muted-foreground">{product.isActive ? "Active" : "Hidden"}</span>
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={!dirty || updateProduct.isPending} onClick={save}>
              {updateProduct.isPending ? "Saving…" : "Save"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowUploader((v) => !v)}>
              Image
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {showUploader && (
        <TableRow>
          <TableCell colSpan={5} className="bg-surface/50">
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

function VendorProductsPage() {
  const search = Route.useSearch();
  const { data: productData, isLoading: productsLoading } = useListVendorProducts();
  const products = productData?.items ?? [];

  return (
    <VendorShell title="Products" description="Update title, price, stock or visibility for products in your store.">
      <div className="rounded-md border border-border p-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
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
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    Loading products…
                  </TableCell>
                </TableRow>
              ) : products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    You have no products yet.
                  </TableCell>
                </TableRow>
              ) : (
                products.map((p) => <EditableRow key={p.id} product={p} highlighted={search.highlight === p.id} />)
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </VendorShell>
  );
}
