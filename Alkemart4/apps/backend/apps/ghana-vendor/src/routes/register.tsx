import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { Storefront, ShieldCheck, TrendUp, WarningCircle } from "@phosphor-icons/react"
import { useRegister } from "../lib/auth"
import { Button, PasswordInput, Input, Label } from "@workspace/ui"

export const Route = createFileRoute("/register")({
  component: RegisterPage,
})

function RegisterPage() {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirm_password: "",
  })
  const register = useRegister()
  const navigate = useNavigate()
  const [passwordError, setPasswordError] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.password.length < 8) {
      setPasswordError("Password must be at least 8 characters")
      return
    }
    if (formData.password !== formData.confirm_password) {
      setPasswordError("Passwords do not match")
      return
    }
    setPasswordError("")
    register.mutate(formData, {
      onSuccess: () => {
        setPasswordError("")
        navigate({ to: "/", replace: true })
      },
    })
  }

  return (
    <div className="grid min-h-[100dvh] md:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-ink px-10 py-10 text-white md:flex lg:px-14 lg:py-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-muted blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-24 h-80 w-80 rounded-full bg-muted blur-3xl"
        />
        <span className="relative text-2xl font-extrabold tracking-tight">
          <span className="text-primary">●</span> alkemart
          <span className="ml-2 text-sm font-bold uppercase tracking-widest text-white/50">Seller</span>
        </span>
        <div className="relative max-w-md space-y-7">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
            <Storefront className="h-6 w-6" weight="bold" aria-hidden />
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-bold leading-tight tracking-tight lg:text-4xl">
              Claim your stall.
            </h2>
            <p className="text-sm leading-relaxed text-white/70">
              Join Ghana&apos;s sellers on Alkemart. Set up in minutes — your shop
              goes live after a quick review by our ops team.
            </p>
          </div>
          <ul className="space-y-4 text-sm">
            <li className="flex items-start gap-3">
              <Storefront className="mt-0.5 h-5 w-5 shrink-0 text-primary" weight="bold" aria-hidden />
              <span>
                <span className="block font-bold">Open in minutes</span>
                <span className="text-white/60">Tell us about your shop — no fees to join.</span>
              </span>
            </li>
            <li className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" weight="bold" aria-hidden />
              <span>
                <span className="block font-bold">Reviewed, then live</span>
                <span className="text-white/60">Our ops team approves new stalls, usually within a day.</span>
              </span>
            </li>
            <li className="flex items-start gap-3">
              <TrendUp className="mt-0.5 h-5 w-5 shrink-0 text-primary" weight="bold" aria-hidden />
              <span>
                <span className="block font-bold">Keep more of every sale</span>
                <span className="text-white/60">Clear commissions and MoMo payouts, no surprises.</span>
              </span>
            </li>
          </ul>
        </div>
        <p className="relative text-xs text-white/50">
          Seller Hub · Powered by Alkemart
        </p>
      </aside>

      {/* Registration panel */}
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
          <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-md sm:p-8">
            <header className="mb-6 space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                Seller Hub
              </p>
              <h1 className="text-2xl font-bold tracking-tight">Create your stall account</h1>
              <p className="text-sm text-muted-foreground">
                A few details and you&apos;re ready to list. Your shop goes live after a quick ops review.
              </p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {register.isError ? (
                <div
                  className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm"
                  role="alert"
                >
                  <WarningCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
                  <div>
                    <p className="font-semibold text-destructive">
                      Couldn&apos;t create your account. Try a different email.
                    </p>
                    {register.error instanceof Error && register.error.message ? (
                      <p className="mt-0.5 text-xs text-destructive/80">{register.error.message}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First name</Label>
                  <Input
                    id="first_name"
                    name="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    autoComplete="given-name"
                    required
                    aria-required
                    className="min-h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last name</Label>
                  <Input
                    id="last_name"
                    name="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    autoComplete="family-name"
                    required
                    aria-required
                    className="min-h-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="you@example.com"
                  autoComplete="username"
                  inputMode="email"
                  required
                  aria-required
                  className="min-h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <PasswordInput
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  autoComplete="new-password"
                  required
                  aria-required
                  aria-describedby={passwordError ? "password-error" : "password-hint"}
                  placeholder="Min. 8 characters"
                />
                <p id="password-hint" className="text-xs text-muted-foreground">
                  At least 8 characters.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirm password</Label>
                <PasswordInput
                  id="confirm_password"
                  name="confirm_password"
                  value={formData.confirm_password}
                  onChange={(e) =>
                    setFormData({ ...formData, confirm_password: e.target.value })
                  }
                  autoComplete="new-password"
                  required
                  aria-required
                  aria-invalid={passwordError ? true : undefined}
                  aria-describedby={passwordError ? "password-error" : undefined}
                  placeholder="Repeat your password"
                />
                {passwordError ? (
                  <p id="password-error" className="text-sm font-semibold text-destructive" role="alert">
                    {passwordError}
                  </p>
                ) : null}
              </div>

              <Button
                type="submit"
                className="min-h-11 w-full text-base font-bold"
                isLoading={register.isPending}
              >
                Create account
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already selling with us?{" "}
              <Link
                to="/login"
                search={{ redirect: undefined, registered: undefined }}
                className="font-bold text-foreground underline underline-offset-2"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
