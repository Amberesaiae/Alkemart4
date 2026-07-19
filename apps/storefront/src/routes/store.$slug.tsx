import { createFileRoute, Navigate } from "@tanstack/react-router"

/** @deprecated use /shops/$slug */
export const Route = createFileRoute("/store/$slug")({
  component: StoreRedirect,
})

function StoreRedirect() {
  const { slug } = Route.useParams()
  return <Navigate to="/shops/$slug" params={{ slug }} replace />
}
