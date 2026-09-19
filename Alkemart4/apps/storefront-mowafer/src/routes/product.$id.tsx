import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/product/$id")({
  component: function ProductStub() {
    const { id } = Route.useParams()
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Product</h1>
        <p className="text-sm text-muted-foreground">{id}</p>
      </div>
    )
  },
})
