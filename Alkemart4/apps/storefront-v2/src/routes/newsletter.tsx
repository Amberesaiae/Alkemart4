import { useEffect, useRef, useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { PageSeo } from "@/components/seo/page-seo"
import { Button } from "@/components/ui/button"
import { confirmNewsletter, unsubscribeNewsletter } from "@/lib/newsletter"

type Search = { action?: "confirm" | "unsubscribe"; t?: string }

export const Route = createFileRoute("/newsletter")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    action: s.action === "confirm" || s.action === "unsubscribe" ? s.action : undefined,
    t: typeof s.t === "string" ? s.t : undefined,
  }),
  component: NewsletterPage,
})

/** Landing for the confirm / unsubscribe links in newsletter emails. */
function NewsletterPage() {
  const { action, t } = Route.useSearch()
  const [state, setState] = useState<"working" | "done" | "invalid">(action && t ? "working" : "invalid")
  const ran = useRef(false)
  useEffect(() => {
    if (ran.current || !action || !t) return
    ran.current = true
    ;(action === "confirm" ? confirmNewsletter(t) : unsubscribeNewsletter(t)).then(
      () => setState("done"),
      () => setState("invalid"),
    )
  }, [action, t])

  const copy =
    state === "working"
      ? { title: "One moment…", body: "" }
      : state === "invalid"
        ? { title: "This link isn't valid", body: "It may have been copied incompletely. Sign up again from the bottom of any page." }
        : action === "confirm"
          ? { title: "You're subscribed 🎉", body: "Deals and new shops, once a week. Every email has a one-tap unsubscribe." }
          : { title: "You're unsubscribed", body: "You won't get newsletter emails from us any more. Order emails still arrive as normal." }

  return (
    <div className="container-page max-w-lg py-16 text-center">
      <PageSeo title="Newsletter" description="alkemart newsletter" path="/newsletter" />
      <h1 className="text-3xl font-extrabold tracking-tight">{copy.title}</h1>
      {copy.body ? <p className="mt-3 text-muted-foreground">{copy.body}</p> : null}
      <Button asChild variant="brand" size="lg" className="mt-8">
        <Link to="/">Back to shopping</Link>
      </Button>
    </div>
  )
}
