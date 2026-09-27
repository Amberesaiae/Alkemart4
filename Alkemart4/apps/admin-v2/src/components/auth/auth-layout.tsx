import { Brand } from "@/components/brand"

/** Operator sign-in: plain, centred, no marketing. */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-ink px-5 py-10">
      <div className="w-full max-w-sm rounded-3xl bg-background p-7 shadow-lift sm:p-9">
        <Brand />
        <div className="mt-8">{children}</div>
      </div>
    </main>
  )
}
