import { useId, useState } from "react"
import { Button } from "./button"
import { Input } from "./input"
import { Label } from "./label"
import { Spinner } from "./spinner"

export function WorkosSignIn({ vendor = false, register = false, start }: {
  vendor?: boolean
  register?: boolean
  start: (input: { mode: "login" | "register"; link?: { email: string; password: string }; shop?: { name: string; handle: string } }) => Promise<void>
}) {
  const id = useId()
  const [linking, setLinking] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [handle, setHandle] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const authError = new URLSearchParams(window.location.search).get("auth_error")
  const callbackMessage = authError === "account_link_required"
    ? "This email already has an Alkemart account. Connect it below using your existing password to keep your orders and shop."
    : authError === "vendor_membership_required"
      ? "This account doesn’t have a shop yet. Choose Open your shop to get started."
      : authError ? "Sign-in couldn’t be completed. Please try again. If you already had an account, connect it below." : null
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await start({ mode: register ? "register" : "login", ...(linking ? { link: { email: email.trim(), password } } : {}), ...(vendor && register ? { shop: { name: name.trim(), handle: handle.trim() } } : {}) })
    } catch (e) { setError(e instanceof Error ? e.message : "Could not start sign-in."); setBusy(false) }
  }
  return <div className="space-y-6">
    <div className="space-y-2">
      <h1 className="text-3xl font-extrabold tracking-tight">{register ? vendor ? "Open your shop" : "Create your account" : "Welcome back"}</h1>
      <p className="text-muted-foreground">{vendor ? "One secure account to shop and manage your business." : "One secure account for your orders and favourite shops."}</p>
    </div>
    {(error || callbackMessage) && <p role="alert" className="rounded-xl bg-muted p-4 text-sm">{error ?? callbackMessage}</p>}
    <form onSubmit={submit} className="space-y-5">
      {vendor && register && <>
        <div className="space-y-2"><Label htmlFor={`${id}-name`}>Shop name</Label><Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoComplete="organization" /></div>
        <div className="space-y-2"><Label htmlFor={`${id}-handle`}>Shop link</Label><Input id={`${id}-handle`} value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase())} minLength={2} maxLength={40} pattern="[a-z0-9]+(-[a-z0-9]+)*" required autoCapitalize="none" /><p className="text-sm text-muted-foreground">Lowercase words joined with hyphens. New shops remain pending review.</p></div>
      </>}
      {linking && <>
        <p className="text-sm text-muted-foreground">Enter your existing Alkemart password, then sign in with the same email on the secure sign-in page. This keeps your account history.</p>
        <div className="space-y-2"><Label htmlFor={`${id}-email`}>Existing account email</Label><Input id={`${id}-email`} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div className="space-y-2"><Label htmlFor={`${id}-password`}>Existing password</Label><Input id={`${id}-password`} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required maxLength={200} /></div>
      </>}
      <Button type="submit" variant="brand" size="xl" className="w-full" disabled={busy}>{busy && <Spinner />}{linking ? "Connect existing account" : "Continue securely"}</Button>
      <p className="text-center text-sm text-muted-foreground">Continue with Google or email on our secure sign-in page. Email verification is required.</p>
    </form>
    <button type="button" onClick={() => { setLinking(!linking); setPassword(""); setError(null) }} className="text-sm font-semibold underline underline-offset-4">{linking ? "Use standard sign-in" : "Already had an Alkemart account? Connect it"}</button>
  </div>
}
