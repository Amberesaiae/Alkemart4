import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/shops/")({
  component: function ShopsIndexStub() {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Stores</h1>
        <p className="text-sm text-muted-foreground">Seller shops load from the catalog when available.</p>
      </div>
    )
  },
})
