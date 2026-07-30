import { createFileRoute, Link } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import { useProducts, useProposeProduct } from "../lib/hooks"
import { Card, Button, Badge, Skeleton } from "@workspace/ui"
import { PlusCircle, CheckCircle, Clock, AlertCircle } from "lucide-react"
import { PageShell } from "../components/page-shell"
import { PageHeader } from "../components/page-header"

export const Route = createFileRoute('/products')({
  component: ProductsPage,
})

function ProductsPage() {
  const qc = useQueryClient()
  const { data, isLoading, isError } = useProducts()
  const propose = useProposeProduct()

  const handlePropose = (id: string) => {
    propose.mutate(id)
  }

  const getStatusBadge = (status: string, product?: Record<string, unknown>) => {
    switch (status) {
      case "published": return <Badge variant="success" className="gap-1"><CheckCircle className="h-3 w-3"/> Published</Badge>
      case "proposed": return <Badge variant="warning" className="gap-1"><Clock className="h-3 w-3"/> In Review</Badge>
      case "rejected": {
        const meta = product?.metadata as Record<string, unknown> | undefined
        const alk = meta?.alkemart as Record<string, unknown> | undefined
        const mod = alk?.moderation as Record<string, unknown> | undefined
        const reason = mod?.reason as string | undefined
        return (
          <Badge variant="destructive" className="gap-1 group relative" title={reason || "Rejected"}>
            <AlertCircle className="h-3 w-3" />
            Rejected
            {reason && (
              <span className="absolute bottom-full right-0 mb-2 hidden group-hover:block bg-popover text-popover-foreground text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap z-10 max-w-64 overflow-hidden text-ellipsis border">
                {reason}
              </span>
            )}
          </Badge>
        )
      }
      default: return <Badge variant="secondary" className="gap-1">Draft</Badge>
    }
  }

  return (
    <PageShell>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader title="Products" description="Manage your inventory and listings." />
        <Link to="/quick-sell">
          <Button size="lg" className="w-full sm:w-auto gap-2 shadow-lg hover:scale-[1.02] transition-transform">
            <PlusCircle className="h-5 w-5" />
            Add Product
          </Button>
        </Link>
      </div>

      {isError ? (
        <Card className="p-8 text-center border-2 border-destructive/20">
          <AlertCircle className="h-10 w-10 mx-auto mb-3 text-destructive" />
          <h2 className="text-lg font-bold mb-1">Failed to load products</h2>
          <p className="text-muted-foreground text-sm mb-4">Something went wrong. Please try again.</p>
          <Button onClick={() => { qc.invalidateQueries({ queryKey: ["vendor", "products"] }) }} variant="outline" className="gap-2">
            Retry
          </Button>
        </Card>
      ) : isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <Card key={i} className="h-64 animate-pulse bg-muted/50 border-none" />
          ))}
        </div>
      ) : !data?.products || data.products.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed">
          <div className="h-20 w-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
          </div>
          <h2 className="text-xl font-bold mb-2">No products yet</h2>
          <p className="text-muted-foreground font-medium mb-6 max-w-sm">
            Add your first item to start selling to customers across the country.
          </p>
          <Link to="/quick-sell">
            <Button size="lg" className="gap-2">
              <PlusCircle className="h-5 w-5" />
              Add First Product
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {data.products.map(product => (
            <Card key={product.id} className="overflow-hidden border-2 hover:border-primary/50 transition-colors flex flex-col">
              <div className="aspect-square bg-muted relative group">
                {product.thumbnail ? (
                  <img src={product.thumbnail} alt={product.title || "Product"} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-20"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  {getStatusBadge(product.status || "draft", product)}
                </div>
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <h3 className="font-bold text-lg line-clamp-1 mb-1" title={product.title || "Untitled"}>
                  {product.title || "Untitled"}
                </h3>
                <p className="text-sm font-semibold text-muted-foreground mt-auto">
                  {product.handle ? `Ref: ${product.handle.slice(0, 8)}` : ""}
                </p>
              </div>
              <div className="p-4 pt-0 border-t border-border/50 mt-auto bg-muted/20 flex gap-2">
                <Link to="/products/$id" params={{ id: product.id }} className="flex-1">
                  <Button className="w-full" size="sm" variant="outline">
                    View Details
                  </Button>
                </Link>
                {product.status === "draft" && (
                  <Button 
                    className="flex-1" 
                    size="sm" 
                    onClick={() => handlePropose(product.id)}
                    isLoading={propose.isPending && propose.variables === product.id}
                  >
                    Submit for Review
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  )
}