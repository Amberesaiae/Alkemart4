import { Button, Input } from "@workspace/ui"
import { getVendorAppUrl } from "@/lib/env"
import { cn } from "@/lib/utils"
import type { FormEvent } from "react"

export function AdvertiseBand({ className }: { className?: string }) {
  const sellUrl = getVendorAppUrl()

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (sellUrl) window.open(sellUrl, "_blank", "noopener,noreferrer")
  }

  return (
    <section
      data-testid="section-advertise"
      className={cn(
        "relative overflow-hidden rounded-2xl bg-primary px-6 py-7 text-primary-foreground sm:px-10 sm:py-8",
        className,
      )}
    >
      <div className="mx-auto max-w-3xl space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">Sell on alkemart</h2>
        <p className="max-w-xl text-sm leading-relaxed opacity-90 sm:text-base">
          Open a shop and list products for buyers nationwide.
        </p>
        <form className="flex flex-col gap-2 sm:flex-row sm:items-center" onSubmit={onSubmit}>
          <Input
            type="email"
            name="email"
            required
            placeholder="Email or phone"
            className="bg-background text-foreground"
            aria-label="Email or phone"
          />
          <Button type="submit" variant="secondary" className="shrink-0">
            Start selling
          </Button>
        </form>
      </div>
    </section>
  )
}
