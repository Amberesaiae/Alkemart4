import { useEffect, useRef, useState } from "react"

type Turnstile = {
  render(el: HTMLElement, options: Record<string, unknown>): string
  remove(id: string): void
}
let loaded: Promise<Turnstile> | undefined
function loadTurnstile() {
  return loaded ??= new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
    script.async = true
    script.onload = () => {
      const api = (window as unknown as { turnstile?: Turnstile }).turnstile
      if (api) resolve(api)
      else { loaded = undefined; reject(new Error("Verification unavailable")) }
    }
    script.onerror = () => { loaded = undefined; reject(new Error("Verification unavailable")) }
    document.head.append(script)
  })
}

/** Shared buyer/seller sign-up challenge; no secret keys belong in the browser. */
export function SignupChallenge({ siteKey, onToken, resetKey = 0 }: {
  siteKey?: string
  onToken: (token: string | null) => void
  resetKey?: number
}) {
  const container = useRef<HTMLDivElement>(null)
  const callback = useRef(onToken)
  useEffect(() => { callback.current = onToken }, [onToken])
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    callback.current(null)
    if (!siteKey || !container.current) return
    let stopped = false
    let api: Turnstile | undefined
    let widget: string | undefined
    void loadTurnstile().then((ready) => {
      if (stopped || !container.current) return
      api = ready
      widget = ready.render(container.current, {
        sitekey: siteKey, action: "signup", theme: "auto",
        callback: (token: string) => { setFailed(false); callback.current(token) },
        "expired-callback": () => callback.current(null),
        "error-callback": () => { setFailed(true); callback.current(null) },
      })
    }).catch(() => { if (!stopped) setFailed(true) })
    return () => { stopped = true; if (widget && api) api.remove(widget) }
  }, [siteKey, resetKey])
  if (!siteKey) return null
  return <div className="space-y-2">
    <div ref={container} />
    {failed ? <p role="alert" className="text-sm text-destructive">Verification couldn't load. Check your connection and reload.</p> : null}
  </div>
}
