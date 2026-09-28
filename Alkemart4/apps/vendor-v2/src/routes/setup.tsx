import { useEffect, useRef } from "react"
import { Link, createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon, CheckmarkCircle02Icon, Copy01Icon, Tag01Icon, WhatsappIcon } from "@hugeicons/core-free-icons"
import { Button } from "@workspace/console-ui/components/button"
import { Skeleton } from "@workspace/console-ui/components/skeleton"
import { ErrorState } from "@workspace/console-ui/components/console/states"
import { cn } from "@workspace/console-ui/lib/utils"
import { Brand } from "@/components/brand"
import { FlowContext } from "@/components/shop/shared"
import { DeliveryCard, LocationCard, LookCard, PayoutCard, PolicyCard } from "@/components/shop/sections"
import { getStorefrontUrl } from "@/lib/env"
import { readSession } from "@/lib/session"
import { SETUP_STEPS, type SetupStepId } from "@/lib/setup"
import type { ShopSettings } from "@/lib/shop"
import { useSetup } from "@/lib/use-setup"
import { BrandIllustration } from "@workspace/console-ui/components/brand-illustration"

type Step = SetupStepId | "done"
const IDS: Step[] = [...SETUP_STEPS.map((s) => s.id), "done"]

export const Route = createFileRoute("/setup")({
  validateSearch: (s: Record<string, unknown>): { step?: Step } => (IDS.includes(s.step as Step) ? { step: s.step as Step } : {}),
  beforeLoad: ({ location }) => {
    if (!readSession()) throw redirect({ to: "/login", search: { redirect: location.href } })
  },
  component: SetupPage,
})

/**
 * First-run setup as a stepper: one decision per screen, saved as you go, so
 * leaving halfway loses nothing. Steps are the same sections as the Shop
 * page, shown bare. Opens at the first unfinished step.
 */
function SetupPage() {
  const { step: asked } = Route.useSearch()
  const navigate = useNavigate()
  const { shop, policy, progress } = useSetup()
  const heading = useRef<HTMLHeadingElement>(null)
  const step: Step | null = asked ?? (progress ? (progress.firstOpen ?? "done") : null)

  // Move focus to the new step's heading so screen readers announce it.
  useEffect(() => {
    heading.current?.focus()
    window.scrollTo({ top: 0 })
  }, [step])

  const go = (to: Step) => void navigate({ to: "/setup", search: { step: to } })
  const index = step ? IDS.indexOf(step) : 0
  const next = () => go(IDS[index + 1] ?? "done")

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
          <Brand />
          <Button asChild variant="ghost" size="lg">
            <Link to="/">Save and exit</Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-6 sm:py-10 lg:grid-cols-[15rem_1fr]">
        {shop.isPending || !progress || !step ? (
          <>
            <Skeleton className="hidden h-72 rounded-2xl lg:block" />
            <Skeleton className="h-[28rem] rounded-2xl" />
          </>
        ) : shop.isError ? (
          <div className="lg:col-span-2">
            <ErrorState title="Your shop didn't load" error={shop.error} onRetry={() => void shop.refetch()} />
          </div>
        ) : (
          <>
            <StepRail current={step} done={progress.done} onGo={go} />
            <main className="min-w-0 space-y-6">
              {step === "done" ? (
                <Done
                  s={shop.data}
                  count={progress.count}
                  total={progress.total}
                  missing={SETUP_STEPS.filter((st) => st.required && !progress.done[st.id]).map((st) => st.title.toLowerCase())}
                  headingRef={heading}
                />
              ) : (
                <>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-muted-foreground tabular">
                      Step {index + 1} of {SETUP_STEPS.length}
                      {SETUP_STEPS[index]?.required ? "" : " · optional"}
                    </p>
                    <h1 ref={heading} tabIndex={-1} className="text-2xl font-extrabold outline-none sm:text-3xl">
                      {SETUP_STEPS[index]?.title}
                    </h1>
                    <p className="max-w-prose text-[15px] text-muted-foreground">{SETUP_STEPS[index]?.blurb}</p>
                  </div>
                  <FlowContext.Provider value={{ next }}>
                    <StepBody step={step} s={shop.data} policy={policy.data?.body ?? null} policyLoading={policy.isPending} />
                  </FlowContext.Provider>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {index > 0 ? (
                      <Button variant="ghost" size="lg" onClick={() => go(IDS[index - 1]!)}>
                        <HugeiconsIcon icon={ArrowLeft01Icon} data-icon="inline-start" /> Back
                      </Button>
                    ) : (
                      <span />
                    )}
                    <Button variant="ghost" size="lg" onClick={next}>
                      Skip for now
                    </Button>
                  </div>
                </>
              )}
            </main>
          </>
        )}
      </div>
    </div>
  )
}

function StepBody({ step, s, policy, policyLoading }: { step: SetupStepId; s: ShopSettings; policy: Parameters<typeof PolicyCard>[0]["current"]; policyLoading: boolean }) {
  switch (step) {
    case "look":
      return <LookCard s={s} />
    case "location":
      return <LocationCard key={JSON.stringify(s.address)} s={s} />
    case "delivery":
      return <DeliveryCard s={s} />
    case "payouts":
      return (
        <PayoutCard
          key={s.payment_details?.phone ?? "none"}
          account={s.payment_details ? { provider: s.payment_details.provider, phoneLast4: s.payment_details.phone.slice(-4) } : null}
        />
      )
    case "returns":
      return <PolicyCard current={policy} loading={policyLoading} />
  }
}

/** Numbered steps: a rail on desktop, a compact progress bar on phones. */
function StepRail({ current, done, onGo }: { current: Step; done: Record<SetupStepId, boolean>; onGo: (s: Step) => void }) {
  const at = IDS.indexOf(current)
  return (
    <nav aria-label="Setup steps">
      <div className="flex gap-1.5 lg:hidden" aria-hidden>
        {SETUP_STEPS.map((st, i) => (
          <span key={st.id} className={cn("h-1.5 flex-1 rounded-full", done[st.id] ? "bg-foreground" : i === at ? "bg-foreground/40" : "bg-muted")} />
        ))}
      </div>
      <ol className="hidden space-y-1 lg:block">
        {SETUP_STEPS.map((st, i) => {
          const isDone = done[st.id]
          const here = st.id === current
          return (
            <li key={st.id}>
              <button
                type="button"
                onClick={() => onGo(st.id)}
                aria-current={here ? "step" : undefined}
                className={cn(
                  "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition-colors",
                  here ? "bg-muted font-bold" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold",
                    isDone ? "bg-foreground text-background" : here ? "border-2 border-foreground text-foreground" : "border-2 border-border",
                  )}
                >
                  {isDone ? <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" aria-hidden /> : i + 1}
                </span>
                <span className="min-w-0">
                  {st.title}
                  {isDone ? <span className="sr-only"> (done)</span> : null}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function Done({ s, count, total, missing, headingRef }: { s: ShopSettings; count: number; total: number; missing: string[]; headingRef: React.Ref<HTMLHeadingElement> }) {
  const url = `${getStorefrontUrl()}/shops/${s.handle}`
  const complete = count === total
  return (
    <div className="space-y-6">
      {complete ? <BrandIllustration name="shop-launched" /> : null}
      <div className="space-y-2">
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-extrabold outline-none sm:text-3xl">
          {complete ? "Your shop is ready 🎉" : `Nice — ${count} of ${total} done`}
        </h1>
        <p className="max-w-prose text-[15px] text-muted-foreground">
          {complete
            ? "Add your first product and share your link. Buyers can order as soon as our team approves your shop."
            : missing.length
              ? `Before you can sell, finish: ${missing.join(" and ")}. The rest can wait — it's all in Shop.`
              : "You're ready to sell. Finish the rest any time from Shop — complete shops get more orders."}
        </p>
      </div>
      <div className="space-y-2 rounded-2xl border p-4">
        <p className="text-sm font-medium">Your shop link</p>
        <p className="truncate font-mono text-sm">{url.replace(/^https?:\/\//, "")}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            variant="outline"
            size="lg"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url)
                toast.success("Link copied")
              } catch {
                toast.error("Couldn't copy — press and hold the link instead.")
              }
            }}
          >
            <HugeiconsIcon icon={Copy01Icon} data-icon="inline-start" /> Copy
          </Button>
          <Button asChild variant="outline" size="lg">
            <a href={`https://wa.me/?text=${encodeURIComponent(`Shop ${s.name} on alkemart 🛍️ ${url}`)}`} target="_blank" rel="noopener noreferrer">
              <HugeiconsIcon icon={WhatsappIcon} data-icon="inline-start" /> WhatsApp
            </a>
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="lg">
          <Link to="/products/new">
            <HugeiconsIcon icon={Tag01Icon} data-icon="inline-start" /> Add my first product
          </Link>
        </Button>
        <Button asChild variant="ghost" size="lg">
          <Link to="/">Go to my dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
