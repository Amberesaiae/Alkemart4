import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { ShieldCheck, Scales, Package, Lock, WarningCircle } from "@phosphor-icons/react"
import { useAuth } from "../hooks/use-auth"
import { Button, Input, PasswordInput, Label } from "@workspace/ui"
import { useTranslation } from "react-i18next"

export const Route = createFileRoute("/login")({
  component: LoginPage,
})

function LoginPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [errorDetail, setErrorDetail] = useState("")
  const { login, isLoggingIn } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setErrorDetail("")
    if (!email || !password) {
      setError(t("login.emptyError"))
      return
    }
    try {
      await login({ email, password })
    } catch (err: unknown) {
      setError(t("login.failedError"))
      if (err instanceof Error && err.message) setErrorDetail(err.message)
    }
  }

  return (
    <div className="grid min-h-[100dvh] md:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-white p-0 text-black md:flex [&>*:not(img):not(.auth-panel-copy)]:hidden">
        {/* Glow & Mesh background accents */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-[420px] w-[420px] rounded-full bg-primary/10 blur-[100px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-36 -left-20 h-96 w-96 rounded-full bg-white/5 blur-[90px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgb(255_196_0_/_0.06)_50%,transparent_100%)]"
        />

        {/* Top Header */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <span className="text-primary text-xl">●</span>
            <span>alkemart</span>
            <span className="ml-1.5 rounded-md border border-white/15 bg-white/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-widest text-white/70 backdrop-blur-md">
              Ops
            </span>
          </div>
        </div>

        <img
          src="/brand/auth/admin.png"
          alt="Marketplace operations illustration"
          className="absolute left-1/2 top-1/2 z-10 h-[118%] w-[118%] max-w-none -translate-x-1/2 -translate-y-1/2 scale-[1.08] object-contain object-center mix-blend-normal"
        />

        <div className="auth-panel-copy absolute left-0 top-0 z-20 w-full bg-white/90 px-8 py-6 backdrop-blur-sm lg:px-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-black/55">Alkemart operations</p>
          <p className="mt-1 text-lg font-black tracking-tight text-black">Keep every marketplace decision moving.</p>
        </div>

        {/* Hero & Glass Feature Cards */}
        <div className="relative z-10 max-w-md space-y-8 my-auto py-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-muted px-3 py-1 text-xs font-semibold text-primary shadow-2xs backdrop-blur-md">
              <ShieldCheck className="h-3.5 w-3.5" weight="bold" />
              <span>Platform Operations Console</span>
            </div>
            <h2 className="text-3xl font-extrabold leading-tight tracking-tight lg:text-4xl">
              Everything marketplace,{" "}
              <span className="text-primary">
                in one console.
              </span>
            </h2>
            <p className="text-sm leading-relaxed text-white/75 font-normal">
              Review seller applications, moderate the catalog, settle orders and disputes, and execute vendor payouts.
            </p>
          </div>

          <div className="space-y-3.5">
            <div className="group flex items-start gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-4 backdrop-blur hover:border-primary/40 hover:bg-white/[0.07]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-primary group-">
                <ShieldCheck className="h-5 w-5" weight="bold" aria-hidden />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-white">Trust &amp; safety first</h3>
                <p className="text-xs text-white/65 leading-relaxed">
                  Sellers and products go live only after thorough ops approval and moderation.
                </p>
              </div>
            </div>

            <div className="group flex items-start gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-4 backdrop-blur hover:border-primary/40 hover:bg-white/[0.07]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-primary group-">
                <Package className="h-5 w-5" weight="bold" aria-hidden />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-white">Full Catalog Control</h3>
                <p className="text-xs text-white/65 leading-relaxed">
                  Manage product listings, taxonomy categories, and featured promotional sections.
                </p>
              </div>
            </div>

            <div className="group flex items-start gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-4 backdrop-blur hover:border-primary/40 hover:bg-white/[0.07]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-primary group-">
                <Scales className="h-5 w-5" weight="bold" aria-hidden />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-white">Financial Settlement</h3>
                <p className="text-xs text-white/65 leading-relaxed">
                  Track platform orders, resolve buyer disputes, and execute vendor MoMo payouts.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Trust Bar */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-white/50">
          <span className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-primary/80" aria-hidden />
            Restricted Access · Audit Logged
          </span>
          <span className="inline-flex items-center gap-1.5 text-primary/80 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-tone-success" />
            Ops Online
          </span>
        </div>
      </aside>

      {/* Sign-in panel */}
      <div className="flex flex-col bg-background">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3 md:hidden">
          <span className="text-lg font-extrabold tracking-tight">
            <span className="text-primary">●</span> alkemart
            <span className="ml-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Ops
            </span>
          </span>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-md rounded-lg border border-black/10 bg-white p-8 shadow-[0_20px_50px_-24px_rgb(0_0_0_/_0.35)] sm:p-10">
            <header className="mb-8 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary">
                Alkemart Ops
              </p>
              <h1 className="text-3xl font-bold tracking-tight">{t("login.title")}</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">{t("login.hint")}</p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {error ? (
                <div
                  className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/10 p-3.5 text-sm"
                  role="alert"
                >
                  <WarningCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
                  <div>
                    <p className="font-semibold text-destructive">{error}</p>
                    {errorDetail ? (
                      <p className="mt-0.5 text-xs text-destructive/80">{errorDetail}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="admin-email">{t("login.email")}</Label>
                <Input
                  id="admin-email"
                  name="email"
                  type="email"
                  placeholder={t("login.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  inputMode="email"
                  required
                  aria-required
                  className="min-h-12 text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">{t("login.password")}</Label>
                <PasswordInput
                  id="admin-password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  aria-required
                  placeholder={t("login.passwordPlaceholder")}
                  className="min-h-12 text-base"
                />
              </div>

              <Button
                type="submit"
                className="min-h-12 w-full text-base font-bold shadow-md mt-2"
                isLoading={isLoggingIn}
              >
                {t("login.signIn")}
              </Button>
            </form>

            <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" aria-hidden />
              {t("login.restrictedNote")}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
