import { useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { FormField } from "@/components/form-field"
import { AuthSplitLayout } from "@/components/auth-split-layout"
import { login, register } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { requireGuest } from "@/lib/route-guards"

export const Route = createFileRoute("/signin")({
  beforeLoad: async () => {
    await requireGuest()
  },
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    if (typeof search.redirect === "string") {
      return { redirect: search.redirect }
    }
    return {}
  },
  component: SignInPage,
})

function safeRedirect(path: string | undefined): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/account"
  return path
}

function SignInPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { redirect } = Route.useSearch()
  const [mode, setMode] = useState<"login" | "register">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")

  const auth = useMutation({
    mutationFn: async () => {
      if (mode === "login") return login(email, password)
      return register({ email, password, firstName, lastName })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["store"] })
      const to = safeRedirect(redirect)
      if (
        to === "/checkout" ||
        to === "/cart" ||
        to === "/orders" ||
        to === "/account"
      ) {
        void navigate({ to })
      } else {
        window.location.assign(to)
      }
    },
  })

  return (
    <AuthSplitLayout
      illustration="authBuyer"
      caption="Buy from Ghana shops"
      brandFooter={
        <Link to="/" className="underline underline-offset-2 hover:text-foreground">
          Continue shopping
        </Link>
      }
    >
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-border px-5 py-4 md:hidden">
        <Link to="/" className="text-lg font-extrabold tracking-tight">
          alkemart<span className="text-primary">.</span>
        </Link>
        <Link to="/" className="text-sm text-muted-foreground">
          Shop
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10 lg:px-14">
        <div className="w-full max-w-md space-y-8">
          <div className="flex gap-1 rounded-full border border-border bg-muted/40 p-1">
            <button
              type="button"
              className={cn(
                "flex-1 rounded-full py-2.5 text-sm font-semibold transition",
                mode === "login"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
              onClick={() => setMode("login")}
            >
              Sign in
            </button>
            <button
              type="button"
              className={cn(
                "flex-1 rounded-full py-2.5 text-sm font-semibold transition",
                mode === "register"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
              onClick={() => setMode("register")}
            >
              Create account
            </button>
          </div>

          <header className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              {mode === "login" ? "Customer sign in" : "Create account"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {mode === "login"
                ? "Orders, addresses, and saved details."
                : "Save addresses and track COD orders."}
            </p>
          </header>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              auth.mutate()
            }}
          >
            {mode === "register" ? (
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  label="First name"
                  value={firstName}
                  onChange={setFirstName}
                  autoComplete="given-name"
                />
                <FormField
                  label="Last name"
                  value={lastName}
                  onChange={setLastName}
                  autoComplete="family-name"
                />
              </div>
            ) : null}
            <FormField
              label="Email"
              value={email}
              onChange={setEmail}
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
            <FormField
              label="Password"
              value={password}
              onChange={setPassword}
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              required
              placeholder="Min. 8 characters"
            />
            {auth.isError ? (
              <p className="text-sm text-destructive" role="alert">
                {auth.error instanceof Error
                  ? auth.error.message
                  : "Could not sign in"}
              </p>
            ) : null}
            <Button
              type="submit"
              size="lg"
              className="min-h-12 w-full rounded-xl text-base"
              disabled={auth.isPending}
            >
              {auth.isPending
                ? "…"
                : mode === "login"
                  ? "Sign in"
                  : "Create account"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            <Link to="/orders" className="font-medium text-foreground underline">
              Find a guest order
            </Link>
          </p>
        </div>
      </div>
    </AuthSplitLayout>
  )
}
