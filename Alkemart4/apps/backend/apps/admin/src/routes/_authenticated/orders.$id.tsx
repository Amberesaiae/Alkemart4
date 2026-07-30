import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { adminOrderDetail } from "../../lib/api"
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Skeleton, Price } from "@workspace/ui"
import { PageShell } from "../../components/page-shell"
import { ArrowLeft, Package, CreditCard, Truck, User, Mail } from "lucide-react"

export const Route = createFileRoute("/_authenticated/orders/$id")({
  component: OrderDetailPage,
})

function OrderDetailPage() {
  const { id } = Route.useParams()
  const { data, isLoading, isError } = useQuery({
    queryKey: ["order", id],
    queryFn: () => adminOrderDetail.retrieve(id),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <PageShell>
        <Skeleton className="h-8 w-48 mb-2" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2"><Skeleton className="h-64 w-full" /></Card>
          <Card><Skeleton className="h-48 w-full" /></Card>
        </div>
      </PageShell>
    )
  }

  if (isError || !data?.order) {
    return (
      <PageShell>
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">Failed to load order details.</div>
      </PageShell>
    )
  }

  const order = data.order

  return (
    <PageShell>
      <Button variant="ghost" size="sm" onClick={() => window.history.back()} className="mb-4 -ml-2">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back
      </Button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Order #{order.display_id}</h1>
            <Badge className="capitalize">{order.status}</Badge>
            <Badge variant="secondary" className="capitalize">{order.payment_status?.replace(/_/g, " ")}</Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Placed {new Date(order.created_at).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Items</CardTitle></CardHeader>
            <CardContent>
              {order.items && order.items.length > 0 ? (
                <ul className="divide-y">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                      <div className="h-12 w-12 rounded-md bg-muted border shrink-0 flex items-center justify-center overflow-hidden">
                        {item.thumbnail ? (
                          <img src={item.thumbnail} alt={item.title} className="h-full w-full object-cover" />
                        ) : (
                          <Package className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.title}</p>
                        {item.variant_title && <p className="text-xs text-muted-foreground">{item.variant_title}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-medium"><Price amount={item.unit_price / 100} currency={order.currency_code} /></p>
                        <p className="text-xs text-muted-foreground">x{item.quantity}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No items</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Shipping</CardTitle></CardHeader>
            <CardContent>
              {order.shipping_address ? (
                <div className="space-y-1 text-sm">
                  <p>{[order.shipping_address.first_name, order.shipping_address.last_name].filter(Boolean).join(" ")}</p>
                  {order.shipping_address.phone && <p>{order.shipping_address.phone}</p>}
                  {order.shipping_address.address_1 && <p>{order.shipping_address.address_1}</p>}
                  {order.shipping_address.address_2 && <p>{order.shipping_address.address_2}</p>}
                  <p>{[order.shipping_address.city, order.shipping_address.province].filter(Boolean).join(", ")}</p>
                  {order.shipping_address.country_code && <p className="uppercase">{order.shipping_address.country_code}</p>}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No shipping address</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Customer</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {order.customer ? (
                <>
                  <div>
                    <p className="font-medium">{order.customer.first_name} {order.customer.last_name}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{order.customer.email}</span>
                  </div>
                </>
              ) : order.email ? (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{order.email}</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Unknown customer</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Summary</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">
                  <Price amount={order.total != null ? order.total / 100 : null} currency={order.currency_code} />
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Payment</span>
                <Badge variant="secondary" className="capitalize text-xs">{order.payment_status?.replace(/_/g, " ")}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Fulfillment</span>
                <Badge variant="secondary" className="capitalize text-xs">{order.fulfillment_status?.replace(/_/g, " ")}</Badge>
              </div>
              {order.total != null && (
                <div className="flex justify-between text-sm pt-2 border-t font-bold">
                  <span>Total</span>
                  <span><Price amount={order.total / 100} currency={order.currency_code} /></span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  )
}
