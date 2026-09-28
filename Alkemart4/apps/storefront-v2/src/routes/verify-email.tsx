import { useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { PageSeo } from "@/components/seo/page-seo"
import { confirmEmailVerification, resendEmailVerification } from "@/lib/auth"

export const Route = createFileRoute("/verify-email")({
  validateSearch: (s: Record<string, unknown>): { token?: string; redirect?: string } => ({
    ...(typeof s.token === "string" ? { token: s.token } : {}),
    ...(typeof s.redirect === "string" && s.redirect.startsWith("/") && !s.redirect.startsWith("//") ? { redirect: s.redirect } : {}),
  }),
  component: VerifyEmailPage,
})

function VerifyEmailPage() {
  const { token, redirect } = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function verify() {
    if (!token) return
    setBusy(true)
    try {
      await confirmEmailVerification(token)
      await queryClient.invalidateQueries({ queryKey: ["store", "session"] })
      setMessage("Email verified. You can continue to checkout.")
      void navigate({ to: (redirect ?? "/checkout") as never, replace: true })
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not verify this email")
    } finally {
      setBusy(false)
    }
  }

  async function resend() {
    setBusy(true)
    try {
      await resendEmailVerification()
      setMessage("If your account still needs verification, a fresh link is on its way.")
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not send a new link")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="container-page flex min-h-[60vh] items-center justify-center py-12">
      <PageSeo title="Verify your email" noindex />
      <section className="w-full max-w-md space-y-5 rounded-3xl border border-border p-7">
        <h1 className="text-3xl font-extrabold">Verify your email</h1>
        <p className="text-muted-foreground">We sent a one-time link to your inbox. Verify that address before placing an order so only you can manage it.</p>
        {message && <p role="status" className="rounded-xl bg-muted p-3 text-sm">{message}</p>}
        {token && <Button type="button" disabled={busy} onClick={() => void verify()}>Verify email</Button>}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <button type="button" disabled={busy} className="font-semibold underline" onClick={() => void resend()}>Send another link</button>
          <Link to="/login" search={{ redirect: "/checkout" }} className="font-semibold underline">Sign in</Link>
        </div>
      </section>
    </main>
  )
}
