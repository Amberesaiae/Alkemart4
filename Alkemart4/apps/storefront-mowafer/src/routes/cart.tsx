import { createFileRoute, Link } from "@tanstack/react-router"

export const Route = createFileRoute("/cart")({
  component: function CartStub() {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Cart</h1>
        <p className="text-sm text-muted-foreground">Your cart is empty.</p>
        <Link to="/" className="text-sm font-semibold underline">
          Continue shopping
        </Link>
      </div>
    )
  },
})
