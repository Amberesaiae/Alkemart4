import { Outlet, createFileRoute } from "@tanstack/react-router"

/**
 * Layout for the /shops tree.
 * /shops        → shops.index.tsx (seller directory)
 * /shops/:slug  → shops.$slug.tsx (seller store page)
 * Parent must render <Outlet/> or the nested child route is swallowed.
 */
export const Route = createFileRoute("/shops")({
  component: ShopsLayout,
})

function ShopsLayout() {
  return <Outlet />
}
