import { useId, useState } from "react"
import { Button } from "./button"
import { Input } from "./input"
import { Label } from "./label"
import { Spinner } from "./spinner"
import { CodeExpiredError, type WorkosBrowser, type WorkosStartInput } from "../lib/workos-browser"

/**
 * Buyer and seller sign-in, entirely on our own page. WorkOS runs behind it:
 * "Continue with Google" goes straight to Google (no hosted page), and email
 * sign-in sends a six-digit code that is entered here. Connecting an old
 * password account works with either.
 */
export function WorkosSignIn({ vendor = false, register = false, browser, redirect }: {
  vendor?: boolean
  register?: boolean
  browser: WorkosBrowser
  redirect?: string
}) {
  const id = useId()
  const [linking, setLinking] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [handle, setHandle] = useState("")
  const [code, setCode] = useState("")
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [busy, setBusy] = useState<"google" | "email" | "code" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const authError = new URLSearchParams(window.location.search).get("auth_error")
  const callbackMessage = authError === "account_link_required"
    ? "This email already has an Alkemart account. Choose Connect it below and enter its password to keep your orders and shop."
    : authError === "vendor_membership_required"
      ? "This account doesn’t have a shop yet. Choose Open your shop to get started."
      : authError ? "Sign-in couldn’t be completed. Please try again." : null

  const needsShop = vendor && register
  const shopReady = !needsShop || (name.trim().length > 0 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(handle) && handle.length >= 2)
  const base = (): WorkosStartInput => ({
    mode: register ? "register" : "login",
    ...(redirect ? { redirect } : {}),
    ...(linking ? { link: { email: email.trim(), password } } : {}),
    ...(needsShop ? { shop: { name: name.trim(), handle: handle.trim() } } : {}),
  })

  async function run(kind: "google" | "email" | "code", action: () => Promise<void>) {
    setError(null)
    setBusy(kind)
    try { await action() } catch (e) {
      if (e instanceof CodeExpiredError) { setSentTo(null); setCode("") }
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.")
      setBusy(null)
    }
  }
  const google = () => run("google", async () => {
    if (!shopReady) throw new Error("Add your shop name and link first.")
    await browser.start({ ...base(), provider: "google" })
  })
  const sendCode = (e?: React.FormEvent) => {
    e?.preventDefault()
    return run("email", async () => {
      if (!shopReady) throw new Error("Add your shop name and link first.")
      const to = email.trim()
      await browser.startEmail({ ...base(), email: to })
      setSentTo(to)
      setCode("")
      setBusy(null)
    })
  }
  const verify = (e: React.FormEvent) => {
    e.preventDefault()
    return run("code", async () => {
      const next = await browser.verifyEmail(code)
      window.location.assign(next)
    })
  }

  const title = register ? vendor ? "Open your shop" : "Create your account" : "Welcome back"
  return <div className="space-y-6">
    <div className="space-y-2">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{sentTo ? "Check your email" : title}</h1>
      <p className="text-muted-foreground">
        {sentTo
          ? <>We sent a 6-digit code to <span className="font-semibold text-foreground">{sentTo}</span>. It works for 10 minutes.</>
          : vendor ? "Sign in to manage your shop." : "Sign in to track orders and check out."}
      </p>
    </div>
    {(error || (!sentTo && callbackMessage)) && <p role="alert" className="rounded-xl bg-muted p-4 text-sm">{error ?? callbackMessage}</p>}

    {sentTo ? (
      <form onSubmit={verify} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`${id}-code`}>6-digit code</Label>
          <Input
            id={`${id}-code`} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus
            className="h-12 text-center text-2xl font-bold tracking-[0.4em]"
          />
        </div>
        <Button type="submit" variant="brand" size="xl" className="w-full" disabled={busy !== null || code.length !== 6}>{busy === "code" && <Spinner />}Sign in</Button>
        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <button type="button" onClick={() => void sendCode()} disabled={busy !== null} className="min-h-10 font-semibold underline underline-offset-4">Send a new code</button>
          <button type="button" onClick={() => { setSentTo(null); setCode(""); setError(null) }} className="min-h-10 font-semibold underline underline-offset-4">Use a different email</button>
        </div>
      </form>
    ) : (
      <div className="space-y-5">
        {needsShop && <div className="space-y-4">
          <div className="space-y-2"><Label htmlFor={`${id}-name`}>Shop name</Label><Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoComplete="organization" /></div>
          <div className="space-y-2"><Label htmlFor={`${id}-handle`}>Shop link</Label><Input id={`${id}-handle`} value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase())} minLength={2} maxLength={40} pattern="[a-z0-9]+(-[a-z0-9]+)*" required autoCapitalize="none" /><p className="text-sm text-muted-foreground">Lowercase words joined with hyphens, like ama-fabrics.</p></div>
        </div>}
        {linking && <div className="space-y-4 rounded-2xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Enter your old Alkemart password once, then continue with Google or an email code using the same email. Your orders and shop stay with you.</p>
          <div className="space-y-2"><Label htmlFor={`${id}-password`}>Old password</Label><Input id={`${id}-password`} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required maxLength={200} /></div>
        </div>}

        <Button type="button" variant="outline" size="xl" className="w-full gap-3 bg-background" onClick={() => void google()} disabled={busy !== null || (linking && (!email.trim() || !password))}>
          {busy === "google" ? <Spinner /> : <GoogleMark />}Continue with Google
        </Button>

        <div className="flex items-center gap-3 text-sm text-muted-foreground" aria-hidden><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>

        <form onSubmit={sendCode} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${id}-email`}>Email</Label>
            <Input id={`${id}-email`} type="email" autoComplete="email" inputMode="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={320} />
          </div>
          <Button type="submit" variant="brand" size="xl" className="w-full" disabled={busy !== null || (linking && !password)}>{busy === "email" && <Spinner />}Email me a code</Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">No password needed. {linking ? "Use the email of your old account." : "New here? The same steps create your account."}</p>
      </div>
    )}

    {!sentTo && <button type="button" onClick={() => { setLinking(!linking); setPassword(""); setError(null) }} className="min-h-10 text-sm font-semibold underline underline-offset-4">
      {linking ? "I don’t have an old account" : "Already had an Alkemart account? Connect it"}
    </button>}
  </div>
}

/** Google's multi-colour "G" (brand mark, not an icon-font glyph). */
function GoogleMark() {
  return <svg viewBox="0 0 48 48" aria-hidden className="size-5 shrink-0">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 38.2 44 33 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
}
