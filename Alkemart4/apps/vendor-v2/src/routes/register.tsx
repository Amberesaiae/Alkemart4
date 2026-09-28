import { useId, useState } from "react"
import { Link, createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { Button } from "@workspace/console-ui/components/button"
import { Input } from "@workspace/console-ui/components/input"
import { Label } from "@workspace/console-ui/components/label"
import { Spinner } from "@workspace/console-ui/components/spinner"
import { SignupChallenge } from "@workspace/console-ui/components/signup-challenge"
import { AuthLayout } from "@/components/auth/auth-layout"
import { PasswordField } from "@/components/auth/password-field"
import { register } from "@/lib/api"
import { getStorefrontUrl } from "@/lib/env"
import { readSession } from "@/lib/session"
import { WorkosSignIn } from "@workspace/console-ui/components/workos-sign-in"
import { workosEnabled, workosBrowser } from "@/lib/workos"

export const Route = createFileRoute("/register")({
  beforeLoad: () => {
    if (readSession()) throw redirect({ to: "/" })
  },
  component: RegisterPage,
})

/** Mirrors the API's handle rule: lowercase words joined by single hyphens. */
export function toHandle(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
}

function RegisterPage() {
  const navigate = useNavigate()
  const ids = { name: useId(), handle: useId(), email: useId() }
  const [name, setName] = useState("")
  const [handle, setHandle] = useState("")
  const [handleEdited, setHandleEdited] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [challengeAttempt, setChallengeAttempt] = useState(0)
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined
  const link = handleEdited ? handle : toHandle(name)
  const linkValid = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(link) && link.length >= 2

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!linkValid) return setError("Your shop link can only use letters, numbers and hyphens.")
    if (password.length < 8) return setError("Your password needs at least 8 characters.")
    if (siteKey && !turnstileToken) return setError("Please complete the verification first.")
    setBusy(true)
    try {
      await register({ email: email.trim(), password, sellerName: name.trim(), sellerHandle: link, turnstileToken: turnstileToken ?? undefined })
      void navigate({ to: "/verify-email" })
    } catch (err) {
      const e2 = err as { status?: number; message?: string }
      setError(
        e2.status === 409
          ? /handle/i.test(e2.message ?? "")
            ? "That shop link is taken. Try adding your area, e.g. -accra."
            : "There's already an account with that email. Sign in instead."
          : e2.status == null
            ? "No connection. Check your data or Wi-Fi and try again."
            : "We couldn't create your shop. Check the details and try again.",
      )
    } finally {
      setBusy(false)
      setChallengeAttempt((n) => n + 1)
    }
  }

  return (
    <AuthLayout>
      {workosEnabled ? <>
        <WorkosSignIn vendor register start={(input) => workosBrowser.start({ ...input, redirect: "/setup" })} />
        <p className="mt-8 text-center"><Link to="/login" className="font-semibold underline">Sign in instead</Link></p>
      </> : <>
      <h1 className="text-3xl font-extrabold tracking-tight">Open your shop</h1>
      <p className="mt-2 text-muted-foreground">It's free. Our team checks every new shop before buyers can order from it.</p>
      <form onSubmit={submit} className="mt-8 space-y-5">
        {error ? (
          <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor={ids.name}>Shop name</Label>
          <Input
            id={ids.name}
            required
            maxLength={80}
            autoComplete="organization"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-12 text-base"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={ids.handle}>Shop link</Label>
          <Input
            id={ids.handle}
            required
            value={link}
            onChange={(e) => {
              setHandleEdited(true)
              setHandle(e.target.value.toLowerCase())
            }}
            aria-describedby={`${ids.handle}-hint`}
            aria-invalid={link && !linkValid ? true : undefined}
            className="h-12 text-base"
          />
          <p id={`${ids.handle}-hint`} className="text-[13px] break-all text-muted-foreground">
            Buyers will find you at {getStorefrontUrl().replace(/^https?:\/\//, "") || "alkemart"}/shops/
            <span className="font-semibold text-foreground">{link || "your-shop"}</span>
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor={ids.email}>Email</Label>
          <Input
            id={ids.email}
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 text-base"
          />
        </div>
        <PasswordField autoComplete="new-password" value={password} onChange={setPassword} hint="At least 8 characters." />
        <SignupChallenge siteKey={siteKey} onToken={setTurnstileToken} resetKey={challengeAttempt} />
        <Button type="submit" variant="brand" size="xl" className="w-full" disabled={busy}>
          {busy ? <Spinner /> : null}
          Create my shop
        </Button>
      </form>
      <p className="mt-8 text-center text-[15px] text-muted-foreground">
        Already selling?{" "}
        <Link to="/login" className="font-semibold text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
      </>}
    </AuthLayout>
  )
}
