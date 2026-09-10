import { useEffect, useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ShoppingBag, MapPin, Truck, Wallet, WarningCircle } from "@phosphor-icons/react"
import { Button } from "@workspace/ui"
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
 * Sign in vs Create account share one gold system; the segmented control
 * marks the active mode.
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
    <div className="grid min-h-screen md:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-ink px-10 py-10 text-white md:flex lg:px-14 lg:py-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-24 h-80 w-80 rounded-full bg-primary/10 blur-3xl"
        />
        <Link to="/" className="relative text-2xl font-extrabold tracking-tight">
          <span className="text-primary">●</span> alkemart
        </Link>
        <div className="relative max-w-md space-y-7">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
            <ShoppingBag className="h-6 w-6" weight="bold" aria-hidden />
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-bold leading-tight tracking-tight lg:text-4xl">
              {mode === "login" ? "Welcome back" : "Join alkemart"}
            </h2>
            <p className="text-sm leading-relaxed text-white/70">
              {mode === "login"
                ? "Sign in for orders and saved addresses — or continue as a guest at checkout."
                : "Create a free shopper account to track orders and save delivery details."}
            </p>
          </div>
          <ul className="space-y-4 text-sm">
            <li className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" weight="bold" aria-hidden />
              <span>
                <span className="block font-bold">Checkout in seconds</span>
                <span className="text-white/60">Ghana delivery details saved for faster checkout.</span>
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Truck className="mt-0.5 h-5 w-5 shrink-0 text-primary" weight="bold" aria-hidden />
              <span>
                <span className="block font-bold">Track every order</span>
                <span className="text-white/60">Follow parcels from stall to doorstep.</span>
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-primary" weight="bold" aria-hidden />
              <span>
                <span className="block font-bold">Pay your way</span>
                <span className="text-white/60">MoMo, cards, or cash on delivery.</span>
              </span>
            </li>
          </ul>
        </div>
        <p className="relative text-xs text-white/50">
          <Link to="/" className="font-semibold text-white/70 underline underline-offset-2 hover:text-white">
            Continue shopping
          </Link>
        </p>
      </aside>

      <div className="flex flex-col bg-background">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
          <Link to="/" className="text-lg font-extrabold tracking-tight">
            <span className="text-primary">●</span> alkemart
          </Link>
          <Link to="/" className="text-sm font-medium text-muted-foreground">
            Shop
          </Link>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-md sm:p-8">
            <div
              className="mb-6 grid grid-cols-2 gap-1 rounded-full border border-border bg-muted/50 p-1"
              role="tablist"
              aria-label="Auth mode"
            >
              {(
                [
                  { key: "login", label: "Sign in" },
                  { key: "register", label: "Create account" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={mode === tab.key}
                  className={cn(
                    "min-h-11 rounded-full text-sm font-bold transition",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    mode === tab.key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setMode(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <header className="mb-6 space-y-1.5">
              <h1 className="text-2xl font-bold tracking-tight">
                {mode === "login" ? "Sign in" : "Create account"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {mode === "login"
                  ? "Welcome back — pick up where you left off."
                  : "Free forever — track orders and check out faster."}
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
                id={mode === "login" ? "shopper-password" : "shopper-new-password"}
                label="Password"
                value={password}
                onChange={setPassword}
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
                placeholder={mode === "login" ? "Enter your password" : "Min. 8 characters"}
              />
              {auth.isError ? (
                <div
                  className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm"
                  role="alert"
                >
                  <WarningCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
                  <div>
                    <p className="font-semibold text-destructive">
                      {mode === "login"
                        ? "Couldn't sign you in. Check your details and try again."
                        : "Couldn't create your account. Try a different email."}
                    </p>
                    {auth.error instanceof Error && auth.error.message ? (
                      <p className="mt-0.5 text-xs text-destructive/80">{auth.error.message}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <Button
                type="submit"
                size="lg"
                className="min-h-11 w-full font-bold"
                isLoading={auth.isPending}
              >
                {mode === "login" ? "Sign in" : "Create account"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
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

            <p className="mt-3 text-center text-sm text-muted-foreground">
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
