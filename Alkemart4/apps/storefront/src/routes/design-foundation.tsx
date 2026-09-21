import { createFileRoute, Link } from "@tanstack/react-router"
import { Button } from "@workspace/ui"
import { BrandLogo } from "@/components/shell/BrandLogo"
import { IconSafe } from "@/design/icons"
import type { IconId } from "@/design/icons"

export const Route = createFileRoute("/design-foundation")({
  component: DesignFoundationPage,
})

const departments: ReadonlyArray<readonly [string, string, IconId]> = [
  ["Electronics", "theme-dept-electronics", "cat-electronics"],
  ["Food", "theme-dept-food", "cat-food"],
  ["Home & pet", "theme-dept-pet", "cat-pet-care"],
  ["Beverages", "theme-dept-beverages", "cat-beverages"],
  ["Baby", "theme-dept-baby", "cat-baby"],
]

function DesignFoundationPage() {
  if (!import.meta.env.DEV) return null

  return (
    <div className="space-y-12 pb-12">
      <header className="grid gap-6 border-b border-border pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="max-w-3xl space-y-4">
          <p className="eyebrow text-muted-foreground">Design foundation · phase 1</p>
          <h1 className="text-4xl font-bold leading-tight text-foreground sm:text-5xl">
            MOWAFER clarity, expressed as Alkemart.
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
            A restrained marketplace system for discovering products, comparing Ghanaian sellers,
            and purchasing with confidence.
          </p>
        </div>
        <BrandLogo size="lg" />
      </header>

      <section className="space-y-6" aria-labelledby="type-title">
        <div>
          <p className="eyebrow text-muted-foreground">01 · Typography</p>
          <h2 id="type-title" className="type-section">One family, clear roles</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-6 shadow-xs">
            <p className="type-pdp-title">Leather sandals made in Ghana</p>
            <p className="mt-2 text-sm font-semibold text-foreground">Hurry Ventures</p>
            <p className="mt-1 type-meta text-muted-foreground">Accra Central · 38 reviews</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-6 shadow-xs">
            <p className="type-section">Deals worth comparing</p>
            <p className="mt-2 type-base text-muted-foreground">
              Browse real offers from local sellers. Every price keeps its seller and context.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-6" aria-labelledby="colour-title">
        <div>
          <p className="eyebrow text-muted-foreground">02 · Colour</p>
          <h2 id="colour-title" className="type-section">Identity without noise</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {departments.map(([label, theme, icon]) => (
            <div key={label} className={`${theme} overflow-hidden rounded-lg border border-border bg-card`}>
              <div className="dept-panel flex aspect-[4/3] items-center justify-center">
                <IconSafe name={icon} size={30} />
              </div>
              <div className="p-4">
                <p className="text-sm font-bold">{label}</p>
                <p className="mt-1 type-meta text-muted-foreground">Wayfinding accent</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-6" aria-labelledby="controls-title">
        <div>
          <p className="eyebrow text-muted-foreground">03 · Controls</p>
          <h2 id="controls-title" className="type-section">One primary decision</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-6 shadow-xs">
          <Button>Add to cart</Button>
          <Button variant="outline">Compare sellers</Button>
          <button className="touch-target inline-flex items-center gap-2 rounded-md px-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
            <IconSafe name="location" size={18} />
            Deliver to Accra Central
          </button>
          <Link to="/" className="text-sm font-bold underline-offset-4 hover:underline">
            Return to storefront
          </Link>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]" aria-labelledby="surface-title">
        <div className="space-y-4">
          <p className="eyebrow text-muted-foreground">04 · Surfaces</p>
          <h2 id="surface-title" className="type-section">Whitespace owns the hierarchy</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-lg border border-border bg-card p-5 shadow-xs">
              <div className="aspect-square rounded-md bg-muted" />
              <p className="mt-4 text-sm font-bold">Everyday wireless headphones</p>
              <p className="mt-1 type-meta text-muted-foreground">Kumasi Tech</p>
              <p className="mt-3 text-lg font-bold">GHS 450.00</p>
            </article>
            <article className="rounded-lg border border-border bg-card p-5 shadow-xs">
              <div className="aspect-square rounded-md bg-muted" />
              <p className="mt-4 text-sm font-bold">Leather sandals</p>
              <p className="mt-1 type-meta text-muted-foreground">Hurry Ventures</p>
              <p className="mt-3 text-lg font-bold">GHS 450.00</p>
            </article>
          </div>
        </div>
        <aside className="self-start rounded-lg border border-border bg-card p-5 shadow-md lg:sticky lg:top-6">
          <p className="text-sm font-bold">Purchase panel</p>
          <p className="mt-1 type-meta text-muted-foreground">Sold by Hurry Ventures</p>
          <p className="mt-6 text-2xl font-bold">GHS 450.00</p>
          <Button className="mt-5 w-full">Add to cart</Button>
          <p className="mt-3 text-center type-meta text-muted-foreground">
            Delivery confirmed at checkout
          </p>
        </aside>
      </section>
    </div>
  )
}
