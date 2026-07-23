import browseArt from "@/assets/illustrations/how-browse.png"
import compareArt from "@/assets/illustrations/how-compare.png"
import payArt from "@/assets/illustrations/how-pay.png"
import deliverArt from "@/assets/illustrations/how-deliver.png"
import { cn } from "@/lib/utils"

type Step = {
  id: string
  title: string
  body: string
  art: string
}

const STEPS: Step[] = [
  {
    id: "browse",
    title: "Browse",
    body: "Categories and shops across Ghana.",
    art: browseArt,
  },
  {
    id: "compare",
    title: "Compare",
    body: "Pick the best price and seller.",
    art: compareArt,
  },
  {
    id: "pay",
    title: "Pay on delivery",
    body: "Cash to the rider — or MoMo when enabled.",
    art: payArt,
  },
  {
    id: "deliver",
    title: "Receive",
    body: "Sellers ship; options set at checkout.",
    art: deliverArt,
  },
]

type Props = {
  className?: string
  title?: string
}

/**
 * How it works — same compact strip pattern as HomeDeliveryBand:
 * horizontal [art | copy] rows (not tall image-on-top cards).
 */
export function HomeHowItWorks({
  className,
  title = "How alkemart works",
}: Props) {
  return (
    <section
      className={cn("space-y-3", className)}
      aria-labelledby="how-alkemart-works"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="how-alkemart-works" className="type-section text-foreground">
          {title}
        </h2>
        <p className="type-sm font-medium text-muted-foreground">
          Browse → deliver
        </p>
      </div>

      <ol className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
        {STEPS.map((step, i) => (
          <li
            key={step.id}
            className={cn(
              "flex items-center gap-3 rounded-xl border border-border bg-card",
              "px-3 py-3 shadow-sm sm:gap-4 sm:px-4 sm:py-3.5",
            )}
          >
            {/* Art plate — same scale language as delivery band */}
            <div
              className={cn(
                "relative flex shrink-0 items-center justify-center rounded-lg bg-muted/60",
                "size-14 sm:size-20",
              )}
            >
              <span
                className={cn(
                  "absolute -left-1 -top-1 flex items-center justify-center rounded-full bg-primary",
                  "size-5 text-[0.65rem] font-extrabold text-primary-foreground sm:size-6 sm:text-xs",
                )}
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <img
                src={step.art}
                alt=""
                width={80}
                height={80}
                className="size-10 object-contain sm:size-14"
                decoding="async"
                loading="lazy"
              />
            </div>

            <div className="min-w-0 flex-1 space-y-0.5">
              <h3 className="text-sm font-bold tracking-tight text-foreground sm:text-base">
                {step.title}
              </h3>
              <p className="text-xs leading-snug text-muted-foreground sm:type-sm sm:leading-relaxed">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
