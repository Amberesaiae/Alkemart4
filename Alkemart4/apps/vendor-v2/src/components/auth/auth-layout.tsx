import { HugeiconsIcon } from "@hugeicons/react"
import { DeliveryBox01Icon, Store04Icon, Wallet01Icon } from "@hugeicons/core-free-icons"
import { Brand } from "@/components/brand"

const POINTS = [
  { icon: Store04Icon, title: "Your own shop page", body: "Buyers find you by name, category and area." },
  { icon: DeliveryBox01Icon, title: "Orders on your phone", body: "See what to pack, mark it sent, done." },
  { icon: Wallet01Icon, title: "Paid to mobile money", body: "Every delivered order is paid out to your MoMo." },
]

/** Sign-in / sign-up frame: form first on phones, gold promise panel on desktop. */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[1fr_minmax(0,560px)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand p-12 lg:flex" aria-label="Why sell on alkemart">
        <Brand />
        <div className="max-w-md space-y-8">
          <h2 className="text-5xl leading-[1] font-extrabold tracking-[-0.04em]">Sell to buyers across the country.</h2>
          <ul className="space-y-5">
            {POINTS.map((p) => (
              <li key={p.title} className="flex gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-foreground text-brand">
                  <HugeiconsIcon icon={p.icon} className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block text-lg font-bold">{p.title}</span>
                  <span className="block text-foreground/80">{p.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm font-medium text-foreground/80">Need help? Email hello@alkemart.app</p>
      </aside>
      <main id="main" className="flex flex-col px-5 py-8 sm:px-10">
        <div className="lg:hidden">
          <Brand />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  )
}
