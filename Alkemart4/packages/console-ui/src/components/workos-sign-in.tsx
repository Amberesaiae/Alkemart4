import { useId, useState } from "react"
import { Button } from "./button"
import { Input } from "./input"
import { Label } from "./label"
import { Spinner } from "./spinner"
import { CodeExpiredError, type WorkosBrowser } from "../lib/workos-browser"

/**
 * One sign-in for everyone, new or returning: Google, or a six-digit code by
 * email. There is no separate sign-up and no password. An existing account
 * with the same email is simply signed in. On the seller app, someone with
 * no shop yet is asked one thing next: the shop's name.
 */
export function WorkosSignIn({ vendor = false, browser, redirect }: {
  vendor?: boolean
  /** Accepted for older callers; sign-in and sign-up are the same now. */
  register?: boolean
  browser: WorkosBrowser
  redirect?: string
}) {
  const id = useId()
  const params = new URLSearchParams(window.location.search)
  const [step, setStep] = useState<"start" | "code" | "shop">(vendor && params.get("step") === "shop" ? "shop" : "start")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [shopName, setShopName] = useState("")
  const [busy, setBusy] = useState<"google" | "email" | "code" | "shop" | null>(null)
  const [error, setError] = useState<string | null>(params.get("auth_error") ? "Sign-in didn’t finish. Please try again." : null)

  async function run(kind: NonNullable<typeof busy>, action: () => Promise<void>) {
    setError(null)
    setBusy(kind)
    try { await action() } catch (e) {
      if (e instanceof CodeExpiredError) { setStep("start"); setCode("") }
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.")
      setBusy(null)
    }
  }
  const google = () => run("google", () => browser.start({ mode: "login", provider: "google", ...(redirect ? { redirect } : {}) }))
  const sendCode = (e?: React.FormEvent) => {
    e?.preventDefault()
    return run("email", async () => {
      await browser.startEmail({ mode: "login", email: email.trim(), ...(redirect ? { redirect } : {}) })
      setStep("code")
      setCode("")
      setBusy(null)
    })
  }
  const verify = (e: React.FormEvent) => {
    e.preventDefault()
    return run("code", async () => {
      const next = await browser.verifyEmail(code)
      if (next === "shop") { setStep("shop"); setBusy(null); return }
      window.location.assign(next)
    })
  }
  const openShop = (e: React.FormEvent) => {
    e.preventDefault()
    return run("shop", async () => window.location.assign(await browser.createShop(shopName.trim())))
  }

  const heading = step === "code" ? "Check your email" : step === "shop" ? "What’s your shop called?" : vendor ? "Sign in to sell on alkemart" : "Sign in to alkemart"
  const intro = step === "code"
    ? <>We sent a 6-digit code to <span className="font-semibold text-foreground">{email.trim()}</span>. It works for 10 minutes.</>
    : step === "shop" ? "You’re signed in. Name your shop — you can change it later."
      : vendor ? "New or returning — the same steps open your seller account." : "New or returning — the same steps create your account."

  return <div className="space-y-6">
    <div className="space-y-2">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{heading}</h1>
      <p className="text-muted-foreground">{intro}</p>
    </div>
    {error && <p role="alert" className="rounded-xl bg-muted p-4 text-sm">{error}</p>}

    {step === "shop" ? (
      <form onSubmit={openShop} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`${id}-shop`}>Shop name</Label>
          <Input id={`${id}-shop`} value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="Ama’s Fabrics" autoComplete="organization" minLength={2} maxLength={80} required autoFocus />
        </div>
        <Button type="submit" variant="brand" size="xl" className="w-full" disabled={busy !== null || shopName.trim().length < 2}>{busy === "shop" && <Spinner />}Open my shop</Button>
      </form>
    ) : step === "code" ? (
      <form onSubmit={verify} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`${id}-code`}>6-digit code</Label>
          <Input
            id={`${id}-code`} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus
            className="h-12 text-center text-2xl font-bold tracking-[0.4em]"
          />
        </div>
        <Button type="submit" variant="brand" size="xl" className="w-full" disabled={busy !== null || code.length !== 6}>{busy === "code" && <Spinner />}Continue</Button>
        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <button type="button" onClick={() => void sendCode()} disabled={busy !== null} className="min-h-10 font-semibold underline underline-offset-4">Send a new code</button>
          <button type="button" onClick={() => { setStep("start"); setCode(""); setError(null) }} className="min-h-10 font-semibold underline underline-offset-4">Use a different email</button>
        </div>
      </form>
    ) : (
      <div className="space-y-5">
        <Button type="button" variant="outline" size="xl" className="w-full gap-3 bg-background" onClick={() => void google()} disabled={busy !== null}>
          {busy === "google" ? <Spinner /> : <GoogleMark />}Continue with Google
        </Button>
        <div className="flex items-center gap-3 text-sm text-muted-foreground" aria-hidden><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
        <form onSubmit={sendCode} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${id}-email`}>Email</Label>
            <Input id={`${id}-email`} type="email" autoComplete="email" inputMode="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={320} />
          </div>
          <Button type="submit" variant="brand" size="xl" className="w-full" disabled={busy !== null}>{busy === "email" && <Spinner />}Email me a code</Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">No password needed.</p>
      </div>
    )}
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
