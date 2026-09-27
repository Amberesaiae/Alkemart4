import { cn } from "@/lib/utils"

/** Header for content pages. Art (Codex) is optional and never behind text. */
export function PageHero({
  eyebrow,
  title,
  lead,
  art,
  children,
  tone = "brand",
}: {
  eyebrow?: string
  title: string
  lead?: string
  art?: string
  children?: React.ReactNode
  tone?: "brand" | "surface"
}) {
  return (
    <section className="container-page pt-4 sm:pt-6">
      <div className={cn("grid items-center gap-6 overflow-hidden rounded-[2rem] p-6 sm:p-10 md:grid-cols-[1.3fr_1fr]", tone === "brand" ? "bg-brand" : "bg-surface")}>
        <div className="space-y-3">
          {eyebrow ? <p className="text-xs font-semibold tracking-[0.18em] uppercase opacity-70">{eyebrow}</p> : null}
          <h1 className="text-4xl leading-tight font-extrabold tracking-[-0.02em] sm:text-5xl">{title}</h1>
          {lead ? <p className="max-w-xl text-base font-medium opacity-80 sm:text-lg">{lead}</p> : null}
          {children ? <div className="flex flex-wrap gap-2 pt-2">{children}</div> : null}
        </div>
        {art ? (
          <img src={art} alt="" className="mx-auto hidden max-h-64 w-auto md:block" onError={(e) => e.currentTarget.remove()} />
        ) : null}
      </div>
    </section>
  )
}
