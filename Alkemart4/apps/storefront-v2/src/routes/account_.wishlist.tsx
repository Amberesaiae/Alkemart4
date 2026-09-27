import { createFileRoute, Navigate } from "@tanstack/react-router"

/** @deprecated use /saved */
export const Route = createFileRoute("/account_/wishlist")({
  component: () => <Navigate to="/saved" replace />,
})
