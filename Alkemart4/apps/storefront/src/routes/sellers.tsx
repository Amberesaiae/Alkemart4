import { createFileRoute, Navigate } from "@tanstack/react-router"

/** @deprecated use /shops */
export const Route = createFileRoute("/sellers")({
  component: () => <Navigate to="/shops" replace />,
})
