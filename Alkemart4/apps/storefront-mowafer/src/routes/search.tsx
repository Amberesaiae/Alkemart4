import { createFileRoute } from "@tanstack/react-router"

export type SearchRouteSearch = {
  q?: string
  deals?: string
}

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>): SearchRouteSearch => ({
    q: typeof search.q === "string" ? search.q : undefined,
    deals: typeof search.deals === "string" ? search.deals : undefined,
  }),
  component: SearchStub,
})

function SearchStub() {
  const { q, deals } = Route.useSearch()
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold tracking-tight">Search</h1>
      <p className="text-sm text-muted-foreground">
        {deals === "1"
          ? "Deals of the day — listings load on this surface when catalog is wired."
          : q
            ? `Looking for “${q}”.`
            : "Find products with the best price across sellers."}
      </p>
    </div>
  )
}
