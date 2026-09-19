import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: function LoginStub() {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">Account sign-in is available from this page.</p>
      </div>
    )
  },
})
