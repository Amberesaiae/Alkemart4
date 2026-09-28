import { useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon, DeliveryTruck01Icon, Store04Icon, Wallet01Icon, ViewIcon, ViewOffIcon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BrandLogo } from "@/components/brand/brand-logo"
import { PageSeo } from "@/components/seo/page-seo"
import { login, register } from "@/lib/auth"
import { SignupChallenge } from "@workspace/console-ui/components/signup-challenge"
import { WorkosSignIn } from "@workspace/console-ui/components/workos-sign-in"
import { workosEnabled, workosBrowser } from "@/lib/workos"

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string; mode?: "login" | "register"; expired?: string } => ({
    ...(typeof s.redirect === "string" ? { redirect: s.redirect } : {}),
    ...(s.expired === "1" || s.expired === 1 ? { expired: "1" } : {}),
    ...(s.mode === "register" || s.mode === "login" ? { mode: s.mode } : {}),
  }),
  component: LoginPage,
})

/** Only same-origin paths; anything else lands on the account page. */
function safeRedirect(path?: string): string {
  return path && path.startsWith("/") && !path.startsWith("//") ? path : "/account"
}

function LoginPage() {
  const { redirect, mode: initial, expired: expiredParam } = Route.useSearch()
  // The route guard can win the race with the redirect, so the reason also
  // rides in sessionStorage (read once, then cleared).
  const [expired] = useState(() => {
    try {
      const why = sessionStorage.getItem("alkemart.signed_out_reason")
      sessionStorage.removeItem("alkemart.signed_out_reason")
      return Boolean(expiredParam) || why === "expired"
    } catch {
      return Boolean(expiredParam)
    }
  })
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<"login" | "register">(initial ?? "login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [show, setShow] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [challengeAttempt, setChallengeAttempt] = useState(0)
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

  const auth = useMutation({
    mutationFn: () => (mode === "login" ? login(email, password) : register({ email, password, turnstileToken: turnstileToken ?? undefined })),
    onSettled: () => setChallengeAttempt((n) => n + 1),
    onSuccess: async (customer) => {
      await queryClient.invalidateQueries({ queryKey: ["store"] })
      if (!customer.emailVerified) {
        void navigate({ to: "/verify-email", search: { redirect: safeRedirect(redirect) }, replace: true })
      } else {
        void navigate({ to: safeRedirect(redirect) as never, replace: true })
      }
    },
  })
  const tooShort = mode === "register" && password.length > 0 && password.length < 8

  // Google or an emailed code both create the account on first use, so there's no separate sign-up switch.
  if (workosEnabled) return <div className="mx-auto max-w-md space-y-4 px-4 pt-4 pb-10 sm:pt-10">
    <PageSeo title={mode === "register" ? "Create account" : "Sign in"} noindex />
    <Link to="/account" className="-ml-1 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
      <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" aria-hidden /> Account
    </Link>
    <WorkosSignIn register={mode === "register"} browser={workosBrowser} redirect={safeRedirect(redirect)} />
  </div>

  return (
    <div className="grid lg:min-h-[calc(100dvh-4.5rem)] lg:grid-cols-2">
      <PageSeo title={mode === "login" ? "Sign in" : "Create account"} noindex />
      <aside className="relative hidden overflow-hidden bg-brand lg:block">
        <img src="/images/auth/buyer.webp" alt="" className="absolute inset-0 size-full object-cover" onError={(e) => e.currentTarget.remove()} />
        <div className="relative flex h-full flex-col justify-between p-12">
          <BrandLogo size="lg" />
          <div className="max-w-md space-y-6 rounded-[2rem] bg-background/85 p-8 backdrop-blur">
            <h2 className="text-3xl font-extrabold">Many sellers. One account.</h2>
            <ul className="space-y-4 text-sm">
              <li className="flex gap-3"><HugeiconsIcon icon={DeliveryTruck01Icon} className="size-5 shrink-0" /> Track every order from shop to doorstep</li>
              <li className="flex gap-3"><HugeiconsIcon icon={Wallet01Icon} className="size-5 shrink-0" /> Pay on delivery, by mobile money or card</li>
              <li className="flex gap-3"><HugeiconsIcon icon={Store04Icon} className="size-5 shrink-0" /> Shop from trusted sellers</li>
            </ul>
          </div>
        </div>
      </aside>

      {/* Phones: the form starts at the top (no floating gap); wide screens centre it beside the art. */}
      <div className="flex items-start justify-center px-4 pt-4 pb-10 lg:items-center lg:py-10">
        <div className="w-full max-w-sm space-y-6">
          <Link to="/account" className="-ml-1 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground lg:hidden">
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" aria-hidden /> Account
          </Link>
          <div className="space-y-2">
            <h1 className="text-[1.375rem] font-extrabold sm:text-3xl">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
            <p className="text-muted-foreground">
              {mode === "login" ? "Sign in to see your orders and alerts." : "Free — track orders and get restock alerts."}
            </p>
          </div>
          <Tabs value={mode} onValueChange={(v) => { setMode(v as "login" | "register"); auth.reset() }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="register">Create account</TabsTrigger>
            </TabsList>
          </Tabs>
          {expired ? (
            <p role="status" className="mb-4 rounded-2xl bg-muted p-3 text-sm font-medium">
              You were signed out because your session ended or your password changed. Sign in again to carry on.
            </p>
          ) : null}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!tooShort && !(mode === "register" && siteKey && !turnstileToken)) auth.mutate()
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field data-invalid={tooShort || undefined}>
                <div className="flex items-center justify-between gap-2">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  {mode === "login" ? (
                    <Link to="/forgot-password" className="inline-flex min-h-11 items-center text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                      Forgot password?
                    </Link>
                  ) : null}
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={show ? "text" : "password"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={tooShort}
                    className="pr-14"
                  />
                  <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute top-1/2 right-0.5 grid size-11 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted md:right-2 md:size-8">
                    <HugeiconsIcon icon={show ? ViewOffIcon : ViewIcon} className="size-4" />
                  </button>
                </div>
                {mode === "register" ? <FieldDescription>At least 8 characters.</FieldDescription> : null}
              </Field>
              {auth.isError ? (
                <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {mode === "login" ? "That email and password don't match." : "We couldn't create that account."}{" "}
                  {auth.error instanceof Error ? <span className="opacity-80">({auth.error.message})</span> : null}
                </p>
              ) : null}
              {mode === "register" ? <SignupChallenge siteKey={siteKey} onToken={setTurnstileToken} resetKey={challengeAttempt} /> : null}
              <Button type="submit" size="xl" className="w-full" disabled={auth.isPending || tooShort || Boolean(mode === "register" && siteKey && !turnstileToken)}>
                {auth.isPending ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
              </Button>
            </FieldGroup>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            Browse freely. A verified account is needed when you place an order.
          </p>
        </div>
      </div>
    </div>
  )
}
