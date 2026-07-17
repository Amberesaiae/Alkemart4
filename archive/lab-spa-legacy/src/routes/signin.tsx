import { useState, useEffect } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Logo } from "@/components/shop/logo"
import { CountrySelect } from "@/components/shop/country-select"
import { useLogin } from "@/lib/hooks-auth"
import { loginSchema, type LoginFormValues } from "@/lib/form-schemas"
import { marketByCode, type MarketCode } from "@/lib/markets"

const signinSearchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute("/signin")({
  validateSearch: signinSearchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — alkemart Ghana" },
      { name: "description", content: "Sign in or create your alkemart account to check out and reorder." },
      { property: "og:title", content: "Sign in — alkemart" },
      { property: "og:description", content: "Sign in to your alkemart Ghana account." },
    ],
  }),
  component: SignInPage,
})

function SignInPage() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const [countryCode, setCountryCode] = useState<MarketCode>("GH")
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  const login = useLogin()

  useEffect(() => {
    if (login.isSuccess && login.data) {
      navigate({ to: search.redirect ?? "/account" })
    }
  }, [login.isSuccess, login.data])

  useEffect(() => {
    if (login.isError) {
      const status = (login.error as any)?.status
      if (status === 404) {
        const email = form.getValues("email")
        navigate({ to: "/signin/create", search: { email, country: countryCode } })
        return
      }
      setFormError("That password doesn't match this email. Please try again.")
    }
  }, [login.isError, login.error])

  function onSubmit(values: LoginFormValues) {
    setFormError(null)
    if (!values.password) {
      navigate({
        to: "/signin/create",
        search: { email: values.email.trim(), country: countryCode },
      })
      return
    }
    login.mutate({ email: values.email.trim(), password: values.password })
  }

  const market = marketByCode(countryCode)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-4">
          <Link to="/" className="inline-flex" aria-label="alkemart home">
            <Logo variant="onLight" />
          </Link>
          <Link to="/" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
            Cancel
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="w-full space-y-6 text-center">
          <div className="flex justify-center">
            <Link to="/" className="inline-flex" aria-label="alkemart home">
              <Logo variant="onLight" />
            </Link>
          </div>

          <div>
            <h1 className="font-display text-2xl font-bold">Sign in or create your account</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in with your email. New here? Leave the password blank to create an account.
            </p>
          </div>

          <form className="space-y-4 text-left" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <div>
              <Label className="text-sm font-bold">Country / market</Label>
              <div className="mt-2">
                <CountrySelect value={countryCode} onChange={setCountryCode} />
              </div>
            </div>
            <div>
              <Label htmlFor="email" className="text-sm font-bold">
                Email <span className="text-muted-foreground">(required)</span>
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                className="mt-2 h-12"
                placeholder={`you@example.com · dial ${market.dialCode}`}
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="mt-1 text-xs font-semibold text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="password" className="text-sm font-bold">
                Password <span className="text-muted-foreground">(leave blank if new)</span>
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                className="mt-2 h-12"
                placeholder="••••••••"
                {...form.register("password")}
              />
              {form.formState.errors.password && (
                <p className="mt-1 text-xs font-semibold text-destructive">
                  {form.formState.errors.password.message}
                </p>
              )}
              <div className="mt-1 text-right">
                <Link to="/signin/forgot" className="text-xs font-semibold text-primary underline">
                  Forgot password?
                </Link>
              </div>
            </div>

            {formError && (
              <p className="text-xs font-semibold text-destructive">{formError}</p>
            )}

            <div className="text-xs text-muted-foreground">
              Securing your personal information is our priority. See our{" "}
              <Link to="/privacy" className="font-semibold text-primary underline">
                privacy notice
              </Link>
              .
            </div>

            <Button size="lg" className="w-full" type="submit" disabled={login.isPending}>
              {login.isPending ? "Checking..." : "Continue"}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Social sign-in is not available yet. Use email and password.
            </p>
          </form>

          <Separator />

          <div className="rounded-md bg-secondary p-6 text-center">
            <div className="font-display text-lg font-bold lowercase">
              alkemart <span className="text-primary">Business</span>
            </div>
            <div className="mt-1 text-sm">Buying for a shop, hotel or office?</div>
            <Button variant="outline" size="sm" className="mt-3" asChild>
              <Link to="/signin/create" search={{ email: "", country: countryCode }}>
                Create a business account
              </Link>
            </Button>
          </div>
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground">
          <div>© 2026 alkemart Ghana Ltd. All Rights Reserved.</div>
          <div className="flex gap-4">
            <Link to="/terms" className="hover:text-foreground">Terms of Use</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy Notice</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
