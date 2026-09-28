import { useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useMutation } from "@tanstack/react-query"
import { Button } from "@workspace/console-ui/components/button"
import { Spinner } from "@workspace/console-ui/components/spinner"
import { AuthLayout } from "@/components/auth/auth-layout"
import { PasswordField } from "@/components/auth/password-field"
import { confirmResetLink } from "@/lib/shop"
import { writeSession } from "@/lib/session"

/** The page the password-change email links to (`VENDOR_URL/reset-password?token=…`). */
export const Route = createFileRoute("/reset-password")({
  validateSearch: (s: Record<string, unknown>): { token?: string } => (typeof s.token === "string" ? { token: s.token } : {}),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { token } = Route.useSearch()
  const [pw, setPw] = useState("")
  const [again, setAgain] = useState("")
  const [tried, setTried] = useState(false)
  const reset = useMutation({
    mutationFn: () => confirmResetLink(token ?? "", pw),
    // The old session is stale once the password changes; sign in fresh.
    onSuccess: () => writeSession(null),
  })
  const short = tried && pw.length < 8
  const mismatch = again.length > 0 && pw !== again

  if (!token) {
    return (
      <AuthLayout>
        <h1 className="text-3xl font-extrabold tracking-tight">This link isn't complete</h1>
        <p className="mt-2 text-muted-foreground">Open the link from your email again, or ask for a new one.</p>
        <Button asChild variant="brand" size="xl" className="mt-8 w-full">
          <Link to="/forgot-password">Get a new link</Link>
        </Button>
      </AuthLayout>
    )
  }

  if (reset.isSuccess) {
    return (
      <AuthLayout>
        <div role="status">
          <h1 className="text-3xl font-extrabold tracking-tight">Password changed</h1>
          <p className="mt-2 text-muted-foreground">Sign in with your new password.</p>
        </div>
        <Button asChild variant="brand" size="xl" className="mt-8 w-full">
          <Link to="/login">Sign in</Link>
        </Button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <h1 className="text-3xl font-extrabold tracking-tight">Choose a new password</h1>
      <p className="mt-2 text-muted-foreground">At least 8 characters. Something you don't use anywhere else.</p>
      <form
        noValidate
        className="mt-8 space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          setTried(true)
          if (pw.length >= 8 && pw === again) reset.mutate()
        }}
      >
        {reset.isError ? (
          <div role="alert" className="space-y-2 rounded-xl bg-danger-soft p-3 text-sm font-medium text-destructive">
            <p>
              {(reset.error as { status?: number }).status == null
                ? "No connection. Check your data or Wi-Fi and try again."
                : reset.error.message || "This link didn't work."}
            </p>
            <Link to="/forgot-password" className="underline underline-offset-4">
              Get a new link
            </Link>
          </div>
        ) : null}
        <PasswordField label="New password" autoComplete="new-password" value={pw} onChange={setPw} invalid={short} hint={short ? "Use at least 8 characters." : undefined} />
        <PasswordField label="Type it again" autoComplete="new-password" value={again} onChange={setAgain} invalid={mismatch} hint={mismatch ? "The two passwords don't match." : undefined} />
        <Button type="submit" variant="brand" size="xl" className="w-full" disabled={reset.isPending}>
          {reset.isPending ? <Spinner /> : null}
          Save new password
        </Button>
      </form>
    </AuthLayout>
  )
}
