import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useMutation } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { PageSeo } from "@/components/seo/page-seo"
import { confirmPasswordReset } from "@/lib/account"

export const Route = createFileRoute("/reset-password")({
  validateSearch: (s: Record<string, unknown>): { token?: string } => (typeof s.token === "string" ? { token: s.token } : {}),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { token } = Route.useSearch()
  const [pw, setPw] = useState("")
  const [again, setAgain] = useState("")
  const [tried, setTried] = useState(false)
  const reset = useMutation({ mutationFn: () => confirmPasswordReset(token ?? "", pw) })
  const mismatch = again.length > 0 && pw !== again

  if (!token) {
    return (
      <div className="container-page max-w-md space-y-4 py-10">
        <PageSeo title="Reset link missing" noindex />
        <h1 className="text-2xl font-extrabold">This link isn't complete</h1>
        <p className="text-muted-foreground">Open the link from your email again, or ask for a new one.</p>
        <Button asChild size="lg">
          <Link to="/forgot-password">Get a new link</Link>
        </Button>
      </div>
    )
  }

  if (reset.isSuccess) {
    return (
      <div className="container-page max-w-md space-y-4 py-10 text-center" role="status">
        <PageSeo title="Password changed" noindex />
        <HugeiconsIcon icon={CheckmarkCircle02Icon} className="mx-auto size-12 text-success" aria-hidden />
        <h1 className="text-2xl font-extrabold">Password changed</h1>
        <p className="text-muted-foreground">Sign in with your new password. Other devices were signed out.</p>
        <Button asChild size="lg">
          <Link to="/login">Sign in</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="container-page flex max-w-md flex-col gap-6 py-10">
      <PageSeo title="Choose a new password" noindex />
      <div className="space-y-2">
        <h1 className="text-2xl font-extrabold">Choose a new password</h1>
        <p className="text-muted-foreground">At least 8 characters. Something you don't use anywhere else.</p>
      </div>
      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          setTried(true)
          if (pw.length >= 8 && pw === again) reset.mutate()
        }}
      >
        {reset.isError ? (
          <div role="alert" className="space-y-2 rounded-2xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
            <p>{(reset.error as Error).message || "This link didn't work."}</p>
            <Link to="/forgot-password" className="underline underline-offset-4">
              Get a new link
            </Link>
          </div>
        ) : null}
        <Field data-invalid={(tried && pw.length < 8) || undefined}>
          <FieldLabel htmlFor="rp-new">New password</FieldLabel>
          <Input id="rp-new" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} aria-invalid={tried && pw.length < 8} className="h-11" />
          {tried && pw.length < 8 ? <FieldDescription className="text-destructive">Use at least 8 characters.</FieldDescription> : null}
        </Field>
        <Field data-invalid={mismatch || undefined}>
          <FieldLabel htmlFor="rp-again">Type it again</FieldLabel>
          <Input id="rp-again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} aria-invalid={mismatch} className="h-11" />
          {mismatch ? <FieldDescription className="text-destructive">The two passwords don't match.</FieldDescription> : null}
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={reset.isPending}>
          {reset.isPending ? <Spinner /> : null}
          Save new password
        </Button>
      </form>
    </div>
  )
}
