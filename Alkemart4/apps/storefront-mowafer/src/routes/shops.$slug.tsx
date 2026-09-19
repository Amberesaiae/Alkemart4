import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/shops/$slug")({
  component: function ShopStub() {
    const { slug } = Route.useParams()
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Store</h1>
        <p className="text-sm text-muted-foreground">{slug}</p>
      </div>
    )
  },
})
