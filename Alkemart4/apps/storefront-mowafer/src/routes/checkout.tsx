import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/checkout")({
  component: function CheckoutStub() {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Checkout</h1>
        <p className="text-sm text-muted-foreground">Address → delivery → payment.</p>
      </div>
    )
  },
})
