import { useId } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { getVendorAppUrl } from "@/lib/env"

/** Seller acquisition strip — the supply side, compact so it closes the page without shouting. */
export function SellerCta() {
  const titleId = useId()
  return (
    <section className="bg-white text-[#111114]" aria-labelledby={titleId}>
      <div className="container-page flex flex-col gap-5 py-8 md:flex-row md:items-center md:gap-8">
        <img
          src="/illustrations/seller-invitation-v1.webp"
          alt=""
          width={600}
          height={400}
          loading="lazy"
          className="hidden h-28 w-44 shrink-0 object-contain md:block"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs font-semibold tracking-[0.18em] text-[#62626b] uppercase">
            Sell on alkemart
          </p>
          <h2
            id={titleId}
            className="text-2xl font-extrabold"
          >
            Bring your shop online.
          </h2>
        </div>
        <Button
          asChild
          variant="brand"
          size="xl"
          className="shrink-0 self-start md:self-center"
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
