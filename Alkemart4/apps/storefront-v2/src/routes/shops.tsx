import { Outlet, createFileRoute } from "@tanstack/react-router"

/** /shops tree layout: /shops (directory), /shops/$slug (store). */
export const Route = createFileRoute("/shops")({
  component: () => <Outlet />,
})
