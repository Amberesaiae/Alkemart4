import { createFileRoute, Navigate } from "@tanstack/react-router"

/**
 * Returns are not in the Workers system of record yet (LIFECYCLE-BUYER).
 * Old links land on the order, whose help panel routes returns to support —
 * never a form that posts to an endpoint that does not exist.
 */
export const Route = createFileRoute("/order/$id/return")({
  component: ReturnRedirect,
})

function ReturnRedirect() {
  return <Navigate to="/order/$id" params={{ id: Route.useParams().id }} replace />
}
