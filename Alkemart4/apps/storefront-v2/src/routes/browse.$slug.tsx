import { createFileRoute, Navigate } from "@tanstack/react-router"

/** @deprecated use /categories/$slug */
export const Route = createFileRoute("/browse/$slug")({
  component: BrowseRedirect,
})

function BrowseRedirect() {
  return <Navigate to="/categories/$slug" params={{ slug: Route.useParams().slug }} replace />
}
