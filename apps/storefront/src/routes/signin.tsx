import { useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { FormField } from "@/components/form-field"
import { LanguageSelect } from "@/components/language-select"
import { login, register } from "@/lib/auth"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/signin")({
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

/**
 * True split-screen auth: left brand panel | right form.
 * Full viewport height; no marketing card-in-a-card layout.
 */
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
    <div className="grid min-h-screen md:grid-cols-2">
      {/* Left panel — full height */}
      <aside className="relative hidden flex-col justify-between bg-foreground px-10 py-10 text-background md:flex lg:px-14 lg:py-12">
        <Link to="/" className="text-2xl font-extrabold tracking-tight">
          alkemart<span className="text-primary">.</span>
        </Link>
        <div className="max-w-md space-y-4">
          <h2 className="text-3xl font-bold leading-tight tracking-tight lg:text-4xl">
            Sign in to manage orders and saved addresses
          </h2>
          <p className="text-sm leading-relaxed text-background/70">
            Customer accounts use Medusa emailpass. Guest checkout still works
            without an account — keep your order id from confirmation.
          </p>
        </div>
        <p className="text-xs text-background/50">
          <Link to="/" className="underline underline-offset-2 hover:text-background">
            Continue shopping
          </Link>
        </p>
      </aside>

      {/* Right panel — form */}
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
          <div className="mb-4 flex justify-end md:mb-6">
            <LanguageSelect />
          </div>
          <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center space-y-6">
            <div className="flex border-b border-border">
              <button
                type="button"
                className={cn(
                  "flex-1 border-b-2 py-3 text-sm font-semibold transition",
                  mode === "login"
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground",
                )}
                onClick={() => setMode("login")}
              >
                Sign in
              </button>
              <button
                type="button"
                className={cn(
                  "flex-1 border-b-2 py-3 text-sm font-semibold transition",
                  mode === "register"
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground",
                )}
                onClick={() => setMode("register")}
              >
                Create account
              </button>
            </div>

            <header className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">
                {mode === "login" ? "Welcome back" : "Create your account"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {mode === "login"
                  ? "Use the email and password for your customer account."
                  : "Register with emailpass. No hardcoded demo users."}
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
              <Button
                type="submit"
                size="lg"
                className="min-h-11 w-full rounded-none"
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
              {" · "}
              <Link to="/" className="font-medium text-foreground underline">
                Back to shop
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
