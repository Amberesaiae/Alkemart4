import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Logo } from "@/components/shop/logo"
import { CountrySelect } from "@/components/shop/country-select"
import { useSignup } from "@/lib/hooks-auth"
import { signupSchema, type SignupFormValues } from "@/lib/form-schemas"
import { marketByCode, type MarketCode } from "@/lib/markets"
import { useState, useEffect } from "react"

const createSearchSchema = z.object({
  email: z.string().optional(),
  country: z.string().optional(),
})

export const Route = createFileRoute("/signin_/create")({
  validateSearch: createSearchSchema,
  head: () => ({
    meta: [
      { title: "Create your account — alkemart Ghana" },
      { name: "description", content: "Finish creating your alkemart Ghana account — a few details and you're in." },
      { property: "og:title", content: "Create your account — alkemart" },
      { property: "og:description", content: "Finish setting up your alkemart Ghana account." },
      { property: "og:url", content: "/signin/create" },
    ],
    links: [{ rel: "canonical", href: "/signin/create" }],
  }),
  component: CreatePage,
})

function CreatePage() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const initialCountry = (search.country as MarketCode) || "GH"
  const market = marketByCode(initialCountry)
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: search.email ?? "",
      password: "",
      firstName: "",
      lastName: "",
      phone: "",
      countryCode: market.code,
      preferredCurrency: market.currency as SignupFormValues["preferredCurrency"],
      locale: market.locale as SignupFormValues["locale"],
    },
  })

  const signup = useSignup()

  useEffect(() => {
    if (signup.isSuccess) {
      navigate({ to: "/account" })
    }
  }, [signup.isSuccess])

  useEffect(() => {
    if (signup.isError) {
      const status = (signup.error as any)?.status
      setFormError(
        status === 409
          ? "An account already exists for that email. Try signing in instead."
          : "Something went wrong creating your account. Please try again.",
      )
    }
  }, [signup.isError, signup.error])

  function onSubmit(values: SignupFormValues) {
    setFormError(null)
    const m = marketByCode(values.countryCode)
    signup.mutate({
      email: values.email.trim(),
      password: values.password,
      firstName: values.firstName?.trim() || undefined,
      lastName: values.lastName?.trim() || undefined,
      phone: values.phone?.trim() || undefined,
      countryCode: values.countryCode,
      preferredCurrency: m.live ? m.currency : "GHS",
      locale: m.locale,
    })
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-4">
          <Link to="/" className="inline-flex" aria-label="alkemart home">
            <Logo variant="onLight" />
          </Link>
          <Link to="/signin" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
            Back to sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col items-center justify-center px-4 py-12">
        <form className="w-full space-y-6" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <div className="text-center">
            <div className="text-xs font-semibold uppercase tracking-widest text-accent">Step 2 of 2</div>
            <h1 className="mt-2 font-display text-2xl font-bold">Create your account</h1>
            <p className="mt-2 text-sm text-muted-foreground">A few details and you're in.</p>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-bold">Country / market</Label>
              <div className="mt-2">
                <CountrySelect
                  value={form.watch("countryCode")}
                  onChange={(code) => {
                    const m = marketByCode(code)
                    form.setValue("countryCode", code)
                    form.setValue("preferredCurrency", (m.live ? m.currency : "GHS") as SignupFormValues["preferredCurrency"])
                    form.setValue("locale", m.locale as SignupFormValues["locale"])
                  }}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email" className="text-sm font-bold">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                className="mt-2 h-12"
                placeholder="ama@example.com"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="mt-1 text-xs font-semibold text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="fn" className="text-sm font-bold">First name</Label>
                <Input id="fn" className="mt-2 h-12" placeholder="Ama" {...form.register("firstName")} />
              </div>
              <div>
                <Label htmlFor="ln" className="text-sm font-bold">Last name</Label>
                <Input id="ln" className="mt-2 h-12" placeholder="Mensah" {...form.register("lastName")} />
              </div>
            </div>

            <div>
              <Label htmlFor="phone" className="text-sm font-bold">Phone (optional)</Label>
              <Input
                id="phone"
                type="tel"
                className="mt-2 h-12"
                placeholder={`${marketByCode(form.watch("countryCode")).dialCode} …`}
                {...form.register("phone")}
              />
              {form.formState.errors.phone && (
                <p className="mt-1 text-xs font-semibold text-destructive">{form.formState.errors.phone.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="password" className="text-sm font-bold">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                className="mt-2 h-12"
                placeholder="At least 8 characters"
                {...form.register("password")}
              />
              {form.formState.errors.password && (
                <p className="mt-1 text-xs font-semibold text-destructive">{form.formState.errors.password.message}</p>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">Minimum 8 characters.</p>
            </div>

            {formError && <p className="text-xs font-semibold text-destructive">{formError}</p>}

            <Button size="lg" className="w-full" type="submit" disabled={signup.isPending}>
              {signup.isPending ? "Creating…" : "Create account"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}
