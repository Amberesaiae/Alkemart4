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
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#16120d] via-[#1c1610] to-[#110d08] px-10 py-10 text-white md:flex lg:px-14 lg:py-12 border-r border-white/10">
        {/* Glow & Mesh background accents */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-[420px] w-[420px] rounded-full bg-gradient-to-br from-primary/30 to-amber-500/10 blur-[100px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-36 -left-20 h-96 w-96 rounded-full bg-primary/15 blur-[90px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(#febf31_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.07]"
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

        {/* Hero & Glass Feature Cards */}
        <div className="relative z-10 max-w-md space-y-8 my-auto py-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary shadow-2xs backdrop-blur-md">
              <ShieldCheck className="h-3.5 w-3.5" weight="bold" />
              <span>Platform Operations Console</span>
            </div>
            <h2 className="text-3xl font-extrabold leading-tight tracking-tight lg:text-4xl">
              Everything marketplace,{" "}
              <span className="bg-gradient-to-r from-primary via-amber-300 to-amber-500 bg-clip-text text-transparent">
                in one console.
              </span>
            </h2>
            <p className="text-sm leading-relaxed text-white/75 font-normal">
              Review seller applications, moderate the catalog, settle orders and disputes, and execute vendor payouts.
            </p>
          </div>

          <div className="space-y-3.5">
            <div className="group flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl transition-all hover:border-primary/40 hover:bg-white/[0.07]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary group-hover:scale-105 transition-transform">
                <ShieldCheck className="h-5 w-5" weight="bold" aria-hidden />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-white">Trust &amp; safety first</h3>
                <p className="text-xs text-white/65 leading-relaxed">
                  Sellers and products go live only after thorough ops approval and moderation.
                </p>
              </div>
            </div>

            <div className="group flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl transition-all hover:border-primary/40 hover:bg-white/[0.07]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary group-hover:scale-105 transition-transform">
                <Package className="h-5 w-5" weight="bold" aria-hidden />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-white">Full Catalog Control</h3>
                <p className="text-xs text-white/65 leading-relaxed">
                  Manage product listings, taxonomy categories, and featured promotional sections.
                </p>
              </div>
            </div>

            <div className="group flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl transition-all hover:border-primary/40 hover:bg-white/[0.07]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary group-hover:scale-105 transition-transform">
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
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
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
          <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-8 shadow-xl sm:p-10">
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
                  className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-sm"
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
