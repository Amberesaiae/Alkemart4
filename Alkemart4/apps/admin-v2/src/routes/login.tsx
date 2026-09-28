import { useEffect, useId, useState } from "react"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { Button } from "@workspace/console-ui/components/button"
import { Input } from "@workspace/console-ui/components/input"
import { Label } from "@workspace/console-ui/components/label"
import { Spinner } from "@workspace/console-ui/components/spinner"
import { AuthLayout } from "@/components/auth/auth-layout"
import { PasswordField } from "@/components/auth/password-field"
import { signIn, signInWithAccess } from "@/lib/api"
import { readSession } from "@/lib/session"

type Search = { redirect?: string }

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    redirect: typeof s.redirect === "string" && s.redirect.startsWith("/") ? s.redirect : undefined,
  }),
  beforeLoad: ({ search }) => {
    if (readSession()) throw redirect({ to: search.redirect ?? "/" })
  },
  component: LoginPage,
})

function LoginPage() {
  const { redirect: back } = Route.useSearch()
  const navigate = useNavigate()
  const emailId = useId()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Production admin is already signed in with Google by Cloudflare Access; turn that
  // into a console session. Only local development (no Access: 404) shows the form.
  const [access, setAccess] = useState<"checking" | "password" | "denied">("checking")
  useEffect(() => {
    let live = true
    signInWithAccess()
      .then(() => { if (live) void navigate({ to: back ?? "/" }) })
      .catch((err) => { if (live) setAccess((err as { status?: number }).status === 404 ? "password" : "denied") })
    return () => { live = false }
  }, [back, navigate])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signIn(email, password)
      void navigate({ to: back ?? "/" })
    } catch (err) {
      const status = (err as { status?: number }).status
      setError(
        status === 401 || status === 400
          ? "That email and password don't match an admin account."
          : status == null
            ? "No connection. Check your data or Wi-Fi and try again."
            : "Something went wrong on our side. Please try again.",
      )
    } finally {
      setBusy(false)
    }
  }

  if (access !== "password") {
    return (
      <AuthLayout>
        <h1 className="text-3xl font-extrabold tracking-tight">{access === "checking" ? "Signing you in…" : "Can’t open the console"}</h1>
        {access === "checking" ? (
          <p role="status" className="mt-4 flex items-center gap-2 text-muted-foreground"><Spinner /> Using your Google sign-in.</p>
        ) : (
          <div className="mt-4 space-y-4 text-muted-foreground">
            <p>This Google account isn’t approved for the alkemart console, or your sign-in has expired.</p>
            <Button asChild variant="outline"><a href="/cdn-cgi/access/logout">Sign in with another Google account</a></Button>
          </div>
        )}
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <h1 className="text-3xl font-extrabold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-muted-foreground">Operators only. Accounts are created by the team.</p>
      <form onSubmit={submit} className="mt-8 space-y-5" noValidate={false}>
        {error ? (
          <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor={emailId}>Email</Label>
          <Input
            id={emailId}
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error ? true : undefined}
            className="h-12 text-base"
          />
        </div>
        <PasswordField autoComplete="current-password" value={password} onChange={setPassword} invalid={Boolean(error)} />
        <Button type="submit" variant="brand" size="xl" className="w-full" disabled={busy}>
          {busy ? <Spinner /> : null}
          Sign in
        </Button>
      </form>
    </AuthLayout>
  )
}
