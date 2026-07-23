import { useEffect, useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { FormField } from "@/components/form-field"
import { login, register } from "@/lib/auth"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/login")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { redirect?: string; mode?: "login" | "register" } => {
    const out: { redirect?: string; mode?: "login" | "register" } = {}
    if (typeof search.redirect === "string") out.redirect = search.redirect
    if (search.mode === "register" || search.mode === "login") {
      out.mode = search.mode
    }
    return out
  },
  component: SignInPage,
})

function safeRedirect(path: string | undefined): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/account"
  return path
}

/**
 * Split-screen shopper auth.
 * Sign in vs Create account are visually distinct (segmented control + CTAs).
 */
function SignInPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { redirect, mode: modeFromSearch } = Route.useSearch()
  const [mode, setMode] = useState<"login" | "register">(
    modeFromSearch === "register" ? "register" : "login",
  )
  useEffect(() => {
    if (modeFromSearch === "register" || modeFromSearch === "login") {
      setMode(modeFromSearch)
    }
  }, [modeFromSearch])
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
    <div className="grid min-h-screen md:grid-cols-2">
      <aside className="relative hidden flex-col justify-between surface-cream px-10 py-10 text-foreground md:flex lg:px-14 lg:py-12">
        <Link to="/" className="text-2xl font-extrabold tracking-tight">
          alkemart<span className="text-primary">.</span>
        </Link>
        <div className="max-w-md space-y-4">
          <h2 className="text-3xl font-bold leading-tight tracking-tight lg:text-4xl">
            {mode === "login" ? "Welcome back" : "Join alkemart"}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {mode === "login"
              ? "Sign in for orders and saved addresses — or continue as a guest at checkout."
              : "Create a free shopper account to track orders and save delivery details."}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          <Link to="/" className="font-semibold underline underline-offset-2 hover:text-foreground">
            Continue shopping
          </Link>
        </p>
      </aside>

      <div className="flex flex-col bg-background">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
          <Link to="/" className="text-lg font-extrabold tracking-tight">
            alkemart<span className="text-primary">.</span>
          </Link>
          <Link to="/" className="text-sm font-medium text-muted-foreground">
            Shop
          </Link>
        </div>

        <div className="flex flex-1 flex-col px-4 py-6 sm:px-8 sm:py-10">
          <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center space-y-6">
            {/* Distinct segmented control: active = filled gold vs muted outline */}
            <div
              className="grid grid-cols-2 gap-1 rounded-full border border-border bg-muted/50 p-1"
              role="tablist"
              aria-label="Auth mode"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === "login"}
                className={cn(
                  "min-h-11 rounded-full text-sm font-bold transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  mode === "login"
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setMode("login")}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "register"}
                className={cn(
                  "min-h-11 rounded-full text-sm font-bold transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  mode === "register"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setMode("register")}
              >
                Create account
              </button>
            </div>

            <header className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">
                {mode === "login" ? "Sign in" : "Create account"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {mode === "login"
                  ? "Use your shopper email and password."
                  : "A few details and you’re ready to shop."}
              </p>
            </header>

            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                auth.mutate()
              }}
            >
              {mode === "register" ? (
                <div className="grid grid-cols-2 gap-2">
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
                    : "Auth failed"}
                </p>
              ) : null}

              {/* Sign in = dark solid; Create = gold primary — never the same look */}
              <Button
                type="submit"
                size="lg"
                className={cn(
                  "min-h-11 w-full rounded-full font-bold",
                  mode === "login"
                    ? "bg-foreground text-background hover:opacity-90"
                    : "bg-primary text-primary-foreground hover:opacity-90",
                )}
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
              {mode === "login" ? (
                <>
                  New here?{" "}
                  <button
                    type="button"
                    className="font-bold text-foreground underline underline-offset-2"
                    onClick={() => setMode("register")}
                  >
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    className="font-bold text-foreground underline underline-offset-2"
                    onClick={() => setMode("login")}
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>

            <p className="text-center text-sm text-muted-foreground">
              <Link to="/orders" className="font-medium underline">
                Find a guest order
              </Link>
              {" · "}
              <Link to="/" className="font-medium underline">
                Back to shop
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
