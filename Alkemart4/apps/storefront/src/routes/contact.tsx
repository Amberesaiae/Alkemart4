import { useState, type FormEvent } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { PageSeo } from "@/components/page-seo"
import { brand } from "@/design/brand"
import { IconSafe } from "@/design/icons"
import { absoluteUrl, organizationJsonLd, siteOrigin } from "@/lib/seo"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/contact")({
  component: ContactPage,
})

const CHANNELS = [
  {
    title: "Shopper help",
    body: "Orders, delivery, and account questions — start with Help & FAQ, or send a message below.",
    to: "/help" as const,
    cta: "Open Help",
    icon: "user" as const,
  },
  {
    title: "Sell on alkemart",
    body: "Register in Seller Hub, get approved, then list products with your own prices.",
    to: "/sell" as const,
    cta: "Start selling",
    icon: "package" as const,
  },
  {
    title: "Browse the market",
    body: "Explore categories and Last Offers from open shops across Ghana.",
    to: "/categories/$slug" as const,
    params: { slug: "all" },
    cta: "All products",
    icon: "search" as const,
  },
]

function ContactPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [topic, setTopic] = useState("general")
  const [message, setMessage] = useState("")
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const origin = siteOrigin()
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(),
      {
        "@type": "ContactPage",
        "@id": absoluteUrl("/contact"),
        url: absoluteUrl("/contact"),
        name: `Contact ${brand.name}`,
        description:
          "Contact alkemart — Ghana multi-vendor marketplace support for shoppers and sellers.",
        isPartOf: origin
          ? { "@type": "WebSite", name: brand.name, url: origin }
          : undefined,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: absoluteUrl("/"),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Contact Us",
            item: absoluteUrl("/contact"),
          },
        ],
      },
    ],
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const n = name.trim()
    const em = email.trim()
    const msg = message.trim()
    if (!n || !em || !msg) {
      setError("Please fill in name, email, and message.")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      setError("Enter a valid email address.")
      return
    }
    // Honest client path — no invented support API. Opens the user’s mail client.
    const subject = encodeURIComponent(
      `[alkemart ${topic}] Message from ${n}`,
    )
    const body = encodeURIComponent(
      `Name: ${n}\nEmail: ${em}\nTopic: ${topic}\n\n${msg}\n`,
    )
    const href = `mailto:hello@alkemart.app?subject=${subject}&body=${body}`
    window.location.href = href
    setSent(true)
  }

  return (
    <>
      <PageSeo
        title="Contact Us"
        description="Contact alkemart for shopper support, seller onboarding, and marketplace questions. Ghana multi-vendor marketplace."
        path="/contact"
        jsonLd={jsonLd}
      />

      <div className="space-y-10 pb-8">
        <header className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-10">
          <div
            className="pointer-events-none absolute -left-10 top-0 h-40 w-40 rounded-full bg-primary/25 blur-3xl"
            aria-hidden
          />
          <div className="relative max-w-2xl space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Contact
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Contact Us
            </h1>
            <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
              We’re here for shoppers and sellers on {brand.name}. Tell us how we
              can help — or jump straight to Help, Sell, or the catalog.
            </p>
          </div>
        </header>

        <ul className="grid gap-4 sm:grid-cols-3">
          {CHANNELS.map((c) => (
            <li
              key={c.title}
              className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                <IconSafe name={c.icon} size={20} />
              </span>
              <h2 className="font-bold text-foreground">{c.title}</h2>
              <p className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground">
                {c.body}
              </p>
              {"params" in c && c.params ? (
                <Link
                  to={c.to}
                  params={c.params}
                  className="mt-4 text-sm font-bold text-primary underline-offset-2 hover:underline"
                >
                  {c.cta} →
                </Link>
              ) : (
                <Link
                  to={c.to}
                  className="mt-4 text-sm font-bold text-primary underline-offset-2 hover:underline"
                >
                  {c.cta} →
                </Link>
              )}
            </li>
          ))}
        </ul>

        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section
            className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8"
            aria-labelledby="form-heading"
          >
            <h2
              id="form-heading"
              className="text-xl font-extrabold tracking-tight"
            >
              Send a message
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Opens your email app with a pre-filled message. No spam, no
              invented tickets.
            </p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" htmlFor="contact-name">
                  <input
                    id="contact-name"
                    name="name"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                    required
                    aria-required="true"
                    aria-invalid={Boolean(error && !name.trim()) || undefined}
                  />
                </Field>
                <Field label="Email" htmlFor="contact-email">
                  <input
                    id="contact-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    required
                    aria-required="true"
                    aria-invalid={Boolean(error && !email.trim()) || undefined}
                  />
                </Field>
              </div>
              <Field label="Topic" htmlFor="contact-topic">
                <select
                  id="contact-topic"
                  name="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className={inputClass}
                >
                  <option value="general">General</option>
                  <option value="order">Order help</option>
                  <option value="seller">Selling / Seller Hub</option>
                  <option value="partnership">Partnership</option>
                  <option value="press">Press</option>
                </select>
              </Field>
              <Field label="Message" htmlFor="contact-message">
                <textarea
                  id="contact-message"
                  name="message"
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className={cn(inputClass, "resize-y min-h-[120px]")}
                  required
                  aria-required="true"
                  aria-invalid={Boolean(error && !message.trim()) || undefined}
                  aria-describedby={error ? "contact-form-error" : undefined}
                />
              </Field>
              {error ? (
                <p
                  id="contact-form-error"
                  className="text-sm font-medium text-destructive"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
              {sent ? (
                <p
                  className="rounded-xl bg-primary/10 px-4 py-3 text-sm font-medium text-foreground"
                  role="status"
                  aria-live="polite"
                >
                  Your mail app should open. If it doesn’t, email{" "}
                  <span className="font-bold">hello@alkemart.app</span> with your
                  message.
                </p>
              ) : null}
              <button
                type="submit"
                className="inline-flex h-11 items-center rounded-full bg-primary px-7 text-sm font-bold text-primary-foreground shadow-sm transition hover:opacity-90"
              >
                Send message
              </button>
            </form>
          </section>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-border bg-muted/40 p-6 sm:p-8">
              <h2 className="text-lg font-extrabold tracking-tight">
                Marketplace notes
              </h2>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
                <li className="flex gap-2">
                  <IconSafe name="check" size={18} className="mt-0.5 shrink-0" />
                  Include your order reference when asking about a purchase.
                </li>
                <li className="flex gap-2">
                  <IconSafe name="check" size={18} className="mt-0.5 shrink-0" />
                  Sellers manage their own stock, delivery, and fulfillment.
                </li>
                <li className="flex gap-2">
                  <IconSafe name="check" size={18} className="mt-0.5 shrink-0" />
                  For Seller Hub access issues, use the Sell page after registration.
                </li>
              </ul>
            </div>
            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Location
              </p>
              <p className="mt-2 text-base font-semibold text-foreground">
                Ghana · Multi-vendor marketplace
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Online marketplace serving shoppers and sellers nationwide.
              </p>
              <Link
                to="/about"
                className="mt-4 inline-flex text-sm font-bold text-primary underline-offset-2 hover:underline"
              >
                Read about us →
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}

const inputClass =
  "min-h-11 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-base sm:text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 focus-visible:ring-2 focus-visible:ring-ring"

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1.5" htmlFor={htmlFor}>
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  )
}
