import { useState } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { Button } from "@workspace/console-ui/components/button"
import { AuthLayout } from "@/components/auth/auth-layout"
import { confirmEmailVerification, resendEmailVerification } from "@/lib/api"
import { readSession } from "@/lib/session"

export const Route = createFileRoute("/verify-email")({
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({ token: typeof search.token === "string" ? search.token : undefined }),
  component: VerifyEmailPage,
})

function VerifyEmailPage() {
  const { token } = Route.useSearch()
  const navigate = useNavigate()
  const session = readSession()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function verify() {
    if (!token) return
    setBusy(true)
    try {
      await confirmEmailVerification(token)
      setMessage("Email verified. You can continue setting up your shop.")
      if (readSession()) void navigate({ to: "/setup" })
    } catch {
      setMessage("This link has expired or has already been used. Request a new one below.")
    } finally {
      setBusy(false)
    }
  }

  async function resend() {
    setBusy(true)
    try {
      await resendEmailVerification()
      setMessage("If your email still needs verification, a new link is on its way.")
    } catch {
      setMessage("We couldn't send a new link right now. Please try again shortly.")
    } finally {
      setBusy(false)
    }
  }

  return <AuthLayout>
    <h1 className="text-3xl font-extrabold tracking-tight">Verify your email</h1>
    <p className="mt-2 text-muted-foreground">Confirm that {session?.user.email ?? "your email address"} belongs to you before setting up payouts.</p>
    {message ? <p role="status" className="mt-6 text-sm">{message}</p> : null}
    <div className="mt-8 space-y-3">
      {token ? <Button variant="brand" size="xl" className="w-full" disabled={busy} onClick={verify}>Confirm email</Button> : null}
      {session ? <Button variant="outline" size="xl" className="w-full" disabled={busy} onClick={resend}>Send a new link</Button> : <Link to="/login">Sign in to request a new link</Link>}
    </div>
  </AuthLayout>
}
