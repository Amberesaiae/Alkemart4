import { createFileRoute, Navigate } from "@tanstack/react-router"

/** @deprecated use /shops/$slug */
export const Route = createFileRoute("/store/$slug")({
  component: StoreRedirect,
})

function StoreRedirect() {
  return <Navigate to="/shops/$slug" params={{ slug: Route.useParams().slug }} replace />
}
