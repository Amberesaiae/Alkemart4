import browseArt from "@/assets/illustrations/how-browse.png"
import compareArt from "@/assets/illustrations/how-compare.png"
import payArt from "@/assets/illustrations/how-pay.png"
import deliverArt from "@/assets/illustrations/how-deliver.png"
import { Link } from "@tanstack/react-router"
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

export function HomeHowItWorks({
  className,
  title = "How alkemart works",
}: Props) {
  return (
    <section
      className={cn("space-y-4 sm:space-y-6", className)}
      aria-labelledby="how-alkemart-works"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="how-alkemart-works" className="type-section text-foreground">
          {title}
        </h2>
        <Link
          to="/delivery"
          className="type-sm font-semibold text-primary underline-offset-2 hover:underline"
        >
          Delivery details
        </Link>
      </div>

      <ol className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 lg:gap-5">
        {STEPS.map((step, i) => (
          <li
            key={step.id}
            className={cn(
              "flex items-center gap-4 rounded-xl shadow-sm sm:gap-5",
              "bg-[var(--footer-bg)] px-4 py-4 sm:px-5 sm:py-5",
              "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]",
            )}
          >
            <div
              className={cn(
                "relative flex shrink-0 items-center justify-center rounded-lg",
                "bg-primary/10 size-16 sm:size-20",
              )}
            >
              <span
                className={cn(
                  "absolute -left-1.5 -top-1.5 flex items-center justify-center rounded-full bg-primary",
                  "size-6 text-xs font-extrabold text-primary-foreground sm:size-7 sm:text-sm",
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
                className="size-11 object-contain sm:size-14"
                decoding="async"
                loading="lazy"
              />
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <h3 className="text-base font-bold tracking-tight text-white/90 sm:text-lg">
                {step.title}
              </h3>
              <p className="text-sm leading-snug text-white/60 sm:text-base sm:leading-relaxed">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
