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
 * “How alkemart works” — compact 4-step band with IconScout illustrations.
 * Sized as a content band (not a full-bleed hero).
 */
export function HomeHowItWorks({
  className,
  title = "How alkemart works",
}: Props) {
  return (
    <section
      className={cn("space-y-5", className)}
      aria-labelledby="how-alkemart-works"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="how-alkemart-works" className="type-section text-foreground">
          {title}
        </h2>
        <p className="text-sm font-medium text-muted-foreground">
          Browse → deliver
        </p>
      </div>

      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <li
            key={step.id}
            className="flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm transition hover:shadow-md"
          >
            <div className="relative flex h-28 items-center justify-center bg-muted/50 sm:h-32">
              <span
                className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground"
                aria-hidden
              >
                {i + 1}
              </span>
              <img
                src={step.art}
                alt=""
                width={160}
                height={160}
                className="h-24 w-24 object-contain sm:h-28 sm:w-28"
                decoding="async"
                loading="lazy"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5 p-4">
              <h3 className="text-base font-bold tracking-tight text-foreground">
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
