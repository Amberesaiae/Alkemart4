import { createFileRoute, redirect } from "@tanstack/react-router"
import { homePath } from "../lib/config"

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: homePath })
  },
})
