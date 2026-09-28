import { useId, useState } from "react"
import { Link, createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { Button } from "@workspace/console-ui/components/button"
import { Input } from "@workspace/console-ui/components/input"
import { Label } from "@workspace/console-ui/components/label"
import { Spinner } from "@workspace/console-ui/components/spinner"
import { AuthLayout } from "@/components/auth/auth-layout"
import { PasswordField } from "@/components/auth/password-field"
import { signIn } from "@/lib/api"
import { readSession } from "@/lib/session"
import { WorkosSignIn } from "@workspace/console-ui/components/workos-sign-in"
import { workosEnabled, workosBrowser } from "@/lib/workos"

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

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const session = await signIn(email, password)
      void navigate({ to: session.user.emailVerified ? back ?? "/" : "/verify-email" })
    } catch (err) {
      const status = (err as { status?: number }).status
      setError(
        status === 401 || status === 400
          ? "That email and password don't match a seller account."
          : status == null
            ? "No connection. Check your data or Wi-Fi and try again."
            : "Something went wrong on our side. Please try again.",
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout>
      {workosEnabled ? <>
        <WorkosSignIn vendor browser={workosBrowser} redirect={back} />
      </> : <>
      <h1 className="text-3xl font-extrabold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-muted-foreground">Sign in to manage your shop.</p>
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
        <p className="-mt-2 text-right text-[15px]">
          <Link to="/forgot-password" className="font-semibold underline underline-offset-4">
            Forgot password?
          </Link>
        </p>
        <Button type="submit" variant="brand" size="xl" className="w-full" disabled={busy}>
          {busy ? <Spinner /> : null}
          Sign in
        </Button>
      </form>
      <p className="mt-8 text-center text-[15px] text-muted-foreground">
        New to alkemart?{" "}
        <Link to="/register" className="font-semibold text-foreground underline underline-offset-4">
          Open your shop
        </Link>
      </p>
      </>}
    </AuthLayout>
  )
}
