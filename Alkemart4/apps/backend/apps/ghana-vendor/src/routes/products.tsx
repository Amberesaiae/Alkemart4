import { createFileRoute, Link } from "@tanstack/react-router"
import { useProducts, useProposeProduct } from "../lib/hooks"
import { Card, Button, Badge } from "../components/ui"
import { PlusCircle, Search, MoreVertical, CheckCircle, Clock, AlertCircle } from "lucide-react"

export const Route = createFileRoute('/products')({
  component: ProductsPage,
})

function ProductsPage() {
  const { data, isLoading } = useProducts()
  const propose = useProposeProduct()

  const handlePropose = (id: string) => {
    propose.mutate(id)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "published": return <Badge variant="success" className="gap-1"><CheckCircle className="h-3 w-3"/> Published</Badge>
      case "proposed": return <Badge variant="warning" className="gap-1"><Clock className="h-3 w-3"/> In Review</Badge>
      case "rejected": return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3"/> Rejected</Badge>
      default: return <Badge variant="secondary" className="gap-1">Draft</Badge>
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Products</h1>
          <p className="text-muted-foreground font-medium">Manage your inventory and listings.</p>
        </div>
        <Link to="/quick-sell">
          <Button size="lg" className="w-full sm:w-auto gap-2 shadow-lg hover:scale-[1.02] transition-transform">
            <PlusCircle className="h-5 w-5" />
            Add Product
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <Card key={i} className="h-64 animate-pulse bg-muted/50 border-none" />
          ))}
        </div>
      ) : !data?.products || data.products.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed">
          <div className="h-20 w-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
            <Package className="h-10 w-10" />
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
                    <Package className="h-12 w-12 opacity-20" />
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  {getStatusBadge(product.status || "draft")}
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
                {product.status === "draft" && (
                  <Button 
                    className="w-full" 
                    size="sm" 
                    onClick={() => handlePropose(product.id)}
                    isLoading={propose.isPending && propose.variables === product.id}
                  >
                    Submit for Review
                  </Button>
                )}
                {product.status !== "draft" && (
                  <Button className="w-full" size="sm" variant="outline" disabled>
                    View Details
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function Package(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round" {...props}><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
  )
}