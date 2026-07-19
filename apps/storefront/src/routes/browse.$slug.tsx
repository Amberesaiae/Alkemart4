import { createFileRoute, Navigate } from "@tanstack/react-router"

/** @deprecated use /categories/$slug */
export const Route = createFileRoute("/browse/$slug")({
  validateSearch: (search: Record<string, unknown>) => {
    const seller =
      typeof search.seller === "string"
        ? search.seller
        : Array.isArray(search.seller)
          ? (search.seller as string[]).join(",")
          : undefined
    const sort = typeof search.sort === "string" ? search.sort : undefined
    return {
      ...(seller ? { seller } : {}),
      ...(sort && sort !== "featured" ? { sort } : {}),
    }
  },
  component: BrowseRedirect,
})

function BrowseRedirect() {
  const { slug } = Route.useParams()
  const search = Route.useSearch()
  return (
    <Navigate to="/categories/$slug" params={{ slug }} search={search} replace />
  )
}
