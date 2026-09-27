import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { PageHero } from "@/components/content/page-hero"
import { PageSeo } from "@/components/seo/page-seo"

export const Route = createFileRoute("/contact")({
  component: ContactPage,
})

const SUPPORT_EMAIL = "hello@alkemart.app"
const TOPICS = ["Order help", "Return or refund", "Payment", "Selling on alkemart", "Something else"]

/**
 * No support ticket API exists yet, so this opens the buyer's own email app
 * with everything filled in — honest, and nothing is lost in a fake form.
 */
function ContactPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [topic, setTopic] = useState(TOPICS[0]!)
  const [ref, setRef] = useState("")
  const [msg, setMsg] = useState("")
  return (
    <div className="space-y-10">
      <PageSeo title="Contact us" description="Get help with an order, a payment or selling on alkemart." path="/contact" />
      <PageHero eyebrow="Contact" title="Talk to us" lead="For anything about an order, include its reference — it gets you an answer faster." art="/illustrations/support.webp" />
      <section className="container-page grid max-w-5xl gap-8 md:grid-cols-[1.4fr_1fr]">
        <form
          className="rounded-3xl border border-border p-6"
          onSubmit={(e) => {
            e.preventDefault()
            const subject = encodeURIComponent(`[${topic}] ${ref ? `Order ${ref} — ` : ""}${name}`)
            const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\nTopic: ${topic}\n${ref ? `Order: ${ref}\n` : ""}\n${msg}\n`)
            window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`
          }}
        >
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field><FieldLabel htmlFor="c-name">Name</FieldLabel><Input id="c-name" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>
              <Field><FieldLabel htmlFor="c-email">Email</FieldLabel><Input id="c-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="c-topic">Topic</FieldLabel>
                <NativeSelect id="c-topic" value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full">
                  {TOPICS.map((t) => <NativeSelectOption key={t} value={t}>{t}</NativeSelectOption>)}
                </NativeSelect>
              </Field>
              <Field><FieldLabel htmlFor="c-ref">Order reference (optional)</FieldLabel><Input id="c-ref" value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
            </div>
            <Field><FieldLabel htmlFor="c-msg">Message</FieldLabel><Textarea id="c-msg" required rows={5} value={msg} onChange={(e) => setMsg(e.target.value)} /></Field>
            <Button type="submit" size="xl">Open in my email app</Button>
          </FieldGroup>
        </form>
        <aside className="space-y-4 text-sm">
          <div className="rounded-3xl bg-surface p-5">
            <p className="font-semibold">Email</p>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-muted-foreground underline-offset-4 hover:underline">{SUPPORT_EMAIL}</a>
          </div>
          <div className="rounded-3xl bg-surface p-5">
            <p className="font-semibold">Quick answers</p>
            <Link to="/help" className="text-muted-foreground underline-offset-4 hover:underline">Help centre</Link>
          </div>
        </aside>
      </section>
    </div>
  )
}
