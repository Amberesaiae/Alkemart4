import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { Storefront, Package, TrendUp, CheckCircle, WarningCircle } from "@phosphor-icons/react"
import { useLogin } from "../lib/auth"
import { Button, PasswordInput, Input, Label } from "@workspace/ui"

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => {
    const result: { redirect?: string; registered?: string } = {}
    if (typeof search.redirect === "string") result.redirect = search.redirect
    if (typeof search.registered === "string") result.registered = search.registered
    return result
  },
  component: LoginPage,
})

function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const login = useLogin()
  const navigate = useNavigate()
  const { redirect, registered } = Route.useSearch()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    login.mutate(
      { email, password },
      {
        onSuccess: () => navigate({ to: redirect || "/" }),
      },
    )
  }

  return (
    <div className="grid min-h-[100dvh] md:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#16120d] via-[#1c1610] to-[#110d08] px-10 py-10 text-white md:flex lg:px-14 lg:py-12 border-r border-white/10">
        {/* Glow & Mesh background accents */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-[420px] w-[420px] rounded-full bg-gradient-to-br from-primary/30 to-amber-500/10 blur-[100px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-36 -left-20 h-96 w-96 rounded-full bg-muted blur-[90px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(#febf31_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.07]"
        />

        {/* Top Header */}
        <div className="relative z-10 flex items-center justify-between">
          <Link to="/login" className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <span className="text-primary text-xl">●</span>
            <span>alkemart</span>
            <span className="ml-1.5 rounded-md border border-white/15 bg-white/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-widest text-white/70 backdrop-blur-md">
              Seller
            </span>
          </Link>
        </div>

        {/* Hero & Glass Feature Cards */}
        <div className="relative z-10 max-w-md space-y-8 my-auto py-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-muted px-3 py-1 text-xs font-semibold text-primary shadow-2xs backdrop-blur-md">
              <Storefront className="h-3.5 w-3.5" weight="bold" />
              <span>Next-Gen Ghanaian Commerce</span>
            </div>
            <h2 className="text-3xl font-extrabold leading-tight tracking-tight lg:text-4xl">
              Your stall,{" "}
              <span className="bg-gradient-to-r from-primary via-amber-300 to-amber-500 bg-clip-text text-transparent">
                open 24/7.
              </span>
            </h2>
            <p className="text-sm leading-relaxed text-white/75 font-normal">
              List products, fulfill orders across Ghana, and receive direct MoMo settlements — all inside a unified workspace.
            </p>
          </div>

          <div className="space-y-3.5">
            <div className="group flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl transition-all hover:border-primary/40 hover:bg-white/[0.07]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-primary group-hover:scale-105 transition-transform">
                <Storefront className="h-5 w-5" weight="bold" aria-hidden />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-white">Sell to all of Ghana</h3>
                <p className="text-xs text-white/65 leading-relaxed">
                  Your offers go live instantly in front of thousands of active buyers nationwide.
                </p>
              </div>
            </div>

            <div className="group flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl transition-all hover:border-primary/40 hover:bg-white/[0.07]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-primary group-hover:scale-105 transition-transform">
                <Package className="h-5 w-5" weight="bold" aria-hidden />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-white">Fulfill with confidence</h3>
                <p className="text-xs text-white/65 leading-relaxed">
                  Pick, pack, and hand off to verified dispatch riders from a single dispatch queue.
                </p>
              </div>
            </div>

            <div className="group flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl transition-all hover:border-primary/40 hover:bg-white/[0.07]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-primary group-hover:scale-105 transition-transform">
                <TrendUp className="h-5 w-5" weight="bold" aria-hidden />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-white">Instant MoMo Payouts</h3>
                <p className="text-xs text-white/65 leading-relaxed">
                  Automated Mobile Money payouts land straight in your MTN, Telecel, or AT wallet.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Trust Bar */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-white/50">
          <span>Seller Hub · Powered by Alkemart</span>
          <span className="inline-flex items-center gap-1.5 text-primary/80 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            24/7 Platform Active
          </span>
        </div>
      </aside>

      {/* Sign-in panel */}
      <div className="flex flex-col bg-background">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
          <span className="text-lg font-extrabold tracking-tight">
            <span className="text-primary">●</span> alkemart
            <span className="ml-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Seller
            </span>
          </span>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-8 shadow-xl sm:p-10">
            <header className="mb-8 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary">
                Seller Hub
              </p>
              <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Sign in to manage your stall — products, orders, and payouts.
              </p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {registered ? (
                <div
                  className="flex items-start gap-2.5 rounded-xl border border-success/20 bg-success/10 p-3.5 text-sm"
                  role="status"
                >
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                  <p className="font-semibold text-success">
                    Stall created! Sign in to start selling.
                  </p>
                </div>
              ) : null}
              {login.isError ? (
                <div
                  className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-sm"
                  role="alert"
                >
                  <WarningCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
                  <div>
                    <p className="font-semibold text-destructive">
                      Couldn&apos;t sign you in. Check your details and try again.
                    </p>
                    {login.error instanceof Error && login.error.message ? (
                      <p className="mt-0.5 text-xs text-destructive/80">{login.error.message}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="vendor-email">Email</Label>
                <Input
                  id="vendor-email"
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="username"
                  inputMode="email"
                  required
                  aria-required
                  className="min-h-12 text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor-password">Password</Label>
                <PasswordInput
                  id="vendor-password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  aria-required
                  placeholder="Enter your password"
                  className="min-h-12 text-base"
                />
              </div>

              <Button
                type="submit"
                className="min-h-12 w-full text-base font-bold shadow-md mt-2"
                isLoading={login.isPending}
              >
                Sign in
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Don&apos;t have a stall?{" "}
              <button
                type="button"
                className="font-bold text-foreground underline underline-offset-2"
                onClick={() => navigate({ to: "/register" })}
              >
                Create one
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
