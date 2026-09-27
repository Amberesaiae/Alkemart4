import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { getVendorAppUrl } from "@/lib/env"
import { cn } from "@/lib/utils"

/** Seller acquisition strip — the supply side, compact so it closes the page without shouting. */
export function SellerCta() {
  // The CTA only makes room for the art once the art actually exists.
  const [art, setArt] = useState(true)
  return (
    <section className="container-page" aria-labelledby="sell-cta-title">
      <div className="relative isolate flex flex-col gap-5 overflow-hidden rounded-[2rem] bg-ink px-6 py-7 text-white on-ink sm:px-10 md:flex-row md:items-center md:justify-between md:gap-10">
        {art ? (
          <img
            src="/images/hero/sell.webp"
            alt=""
            loading="lazy"
            className="absolute inset-y-0 right-0 -z-10 hidden h-full w-[38%] object-cover object-left opacity-90 lg:block"
            onError={() => setArt(false)}
          />
        ) : null}
        <div className="max-w-xl space-y-1.5">
          <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
            Sell on alkemart
          </p>
          <h2
            id="sell-cta-title"
            className="text-2xl font-extrabold sm:text-3xl"
          >
            Your shop, in front of every buyer.
          </h2>
          <p className="text-[15px] text-white/75">
            List once, set your own delivery fee, get paid through the platform.
          </p>
        </div>
        <Button
          asChild
          variant="brand"
          size="xl"
          className={cn(
            "shrink-0 self-start md:self-center",
            art && "lg:mr-[38%]"
          )}
        >
          <a href={getVendorAppUrl()}>
            Start selling
            <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
          </a>
        </Button>
      </div>
    </section>
  )
}
