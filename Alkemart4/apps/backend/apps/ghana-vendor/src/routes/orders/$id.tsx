import { createFileRoute, Link, useParams } from "@tanstack/react-router"
import { useState } from "react"
import { useOrder, useFulfillOrder, useShipOrder, useDeliverOrder } from "../../lib/hooks"
import { Card, Button, Badge, Input } from "../../components/ui"
import { ArrowLeft, Box, Truck, CheckCircle2, User, MapPin } from "lucide-react"
import { format } from "date-fns"

export const Route = createFileRoute('/orders/$id')({
  component: OrderDetailPage,
})

function OrderDetailPage() {
  const { id } = Route.useParams()
  const { data, isLoading } = useOrder(id)
  const order = data?.order

  const fulfill = useFulfillOrder()
  const ship = useShipOrder()
  const deliver = useDeliverOrder()

  const [tracking, setTracking] = useState("")

  const formatGhs = (amount = 0) => 
    new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(amount)

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-48 bg-muted rounded-md" />
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 h-[400px] bg-muted rounded-xl" />
          <div className="h-[400px] bg-muted rounded-xl" />
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold">Order not found</h2>
        <Link to="/orders">
          <Button className="mt-4">Back to Orders</Button>
        </Link>
      </div>
    )
  }

  const fulfillment = order.fulfillments?.[0]
  
  const handleFulfill = () => {
    if (!order.items) return
    fulfill.mutate({ 
      orderId: order.id, 
      items: order.items.map(item => ({ id: item.id, quantity: item.quantity || 1 }))
    })
  }

  const handleShip = () => {
    if (!fulfillment) return
    ship.mutate({ orderId: order.id, fulfillmentId: fulfillment.id, tracking })
  }

  const handleDeliver = () => {
    if (!fulfillment) return
    deliver.mutate({ orderId: order.id, fulfillmentId: fulfillment.id })
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Link to="/orders">
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
              Order #{order.display_id}
              <Badge variant={
                order.fulfillment_status === "fulfilled" ? "success" : 
                order.fulfillment_status === "shipped" ? "default" : 
                "warning"
              } className="text-sm">
                {order.fulfillment_status === "not_fulfilled" ? "Pending" : 
                 order.fulfillment_status?.replace(/_/g, " ") || "Pending"}
              </Badge>
            </h1>
            <p className="text-muted-foreground font-medium mt-1">
              Placed on {order.created_at ? format(new Date(order.created_at), "PPP 'at' p") : "-"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 items-start">
        <div className="md:col-span-2 space-y-6">
          <Card className="border-2 p-6 shadow-sm">
            <h2 className="text-lg font-bold mb-4">Items</h2>
            <div className="space-y-4">
              {order.items?.map(item => (
                <div key={item.id} className="flex gap-4 items-center p-3 rounded-lg border border-border/50 bg-muted/20">
                  <div className="h-16 w-16 bg-muted rounded-md overflow-hidden shrink-0 flex items-center justify-center">
                    {item.thumbnail ? (
                      <img src={item.thumbnail} alt={item.title || ""} className="h-full w-full object-cover" />
                    ) : (
                      <Box className="h-6 w-6 text-muted-foreground opacity-50" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base line-clamp-1">{item.title}</h3>
                    {item.variant_title && (
                      <p className="text-sm text-muted-foreground font-medium">{item.variant_title}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-black text-lg">{formatGhs(item.unit_price ? item.unit_price / 100 : 0)}</p>
                    <p className="text-sm text-muted-foreground font-bold">Qty: {item.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 pt-6 border-t border-border space-y-2 text-right">
              <div className="flex justify-end gap-8 text-muted-foreground font-medium">
                <span>Subtotal</span>
                <span className="w-24">{formatGhs(order.subtotal ? order.subtotal / 100 : 0)}</span>
              </div>
              <div className="flex justify-end gap-8 text-muted-foreground font-medium">
                <span>Shipping</span>
                <span className="w-24">{formatGhs(order.shipping_total ? order.shipping_total / 100 : 0)}</span>
              </div>
              <div className="flex justify-end gap-8 text-xl font-black pt-2">
                <span>Total</span>
                <span className="w-24 text-primary">{formatGhs(order.total ? order.total / 100 : 0)}</span>
              </div>
            </div>
          </Card>

          <Card className="border-2 p-6 shadow-sm">
            <h2 className="text-lg font-bold mb-6">Fulfillment Workflow</h2>
            
            <div className="space-y-6">
              {/* Step 1: Pack */}
              <div className="flex gap-4">
                <div className={`mt-1 h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${order.fulfillment_status !== "not_fulfilled" ? "bg-success text-white" : "bg-primary text-primary-foreground"}`}>
                  <Box className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-base">Pack Order</h3>
                  <p className="text-sm text-muted-foreground mb-3 font-medium">Prepare items for dispatch.</p>
                  {order.fulfillment_status === "not_fulfilled" && (
                    <Button 
                      onClick={handleFulfill} 
                      isLoading={fulfill.isPending}
                    >
                      Mark as Packed
                    </Button>
                  )}
                </div>
              </div>

              {/* Step 2: Ship */}
              <div className={`flex gap-4 ${order.fulfillment_status === "not_fulfilled" ? "opacity-50 pointer-events-none" : ""}`}>
                <div className={`mt-1 h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${order.fulfillment_status === "shipped" || order.fulfillment_status === "fulfilled" ? "bg-success text-white" : "bg-muted text-muted-foreground"}`}>
                  <Truck className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-base">Dispatch</h3>
                  <p className="text-sm text-muted-foreground mb-3 font-medium">Hand over to delivery rider.</p>
                  {order.fulfillment_status === "fulfilled" && !fulfillment?.shipped_at && (
                    <div className="space-y-3">
                      <Input 
                        placeholder="Rider Phone or Tracking (Optional)" 
                        value={tracking}
                        onChange={e => setTracking(e.target.value)}
                        className="h-10"
                      />
                      <Button 
                        onClick={handleShip} 
                        isLoading={ship.isPending}
                        className="w-full sm:w-auto"
                      >
                        Mark as Dispatched
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 3: Deliver */}
              <div className={`flex gap-4 ${order.fulfillment_status !== "shipped" ? "opacity-50 pointer-events-none" : ""}`}>
                <div className={`mt-1 h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${order.fulfillment_status === "delivered" || order.fulfillment_status === "fulfilled" && fulfillment?.delivered_at ? "bg-success text-white" : "bg-muted text-muted-foreground"}`}>
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-base">Delivered</h3>
                  <p className="text-sm text-muted-foreground mb-3 font-medium">Customer received the item.</p>
                  {order.fulfillment_status === "shipped" && (
                    <Button 
                      onClick={handleDeliver} 
                      isLoading={deliver.isPending}
                      variant="outline"
                      className="w-full sm:w-auto border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                    >
                      Confirm Delivery
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-2 p-6 shadow-sm bg-muted/10">
            <h2 className="text-base font-bold flex items-center gap-2 mb-4">
              <User className="h-4 w-4 text-muted-foreground" /> Customer
            </h2>
            <div className="space-y-1">
              <p className="font-bold">{order.email}</p>
              {order.shipping_address && (
                <div className="mt-4 pt-4 border-t border-border">
                  <h3 className="text-sm font-bold flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" /> Delivery Address
                  </h3>
                  <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                    {(order.shipping_address as any).address_1}<br/>
                    {(order.shipping_address as any).city}, {(order.shipping_address as any).country_code?.toUpperCase()}
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}