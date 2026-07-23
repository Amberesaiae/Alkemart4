import type { ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import { illustration, type IllustrationKey } from "@/lib/illustrations"
import { cn } from "@/lib/utils"

type AuthSplitLayoutProps = {
  illustration: IllustrationKey
  caption?: string
  brandFooter?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * Split auth: seamless cream panel + large centered transparent art | form.
 *
 * Pack-6 silhouettes are transparent PNG/WebP. Panel bg is continuous cream
 * so edges never show as a white “card” with corners.
 */
export function AuthSplitLayout({
  illustration: artKey,
  caption,
  brandFooter,
  children,
  className,
}: AuthSplitLayoutProps) {
  const asset = illustration(artKey)

  return (
    <div
      className={cn(
        "grid h-dvh max-h-dvh overflow-hidden md:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]",
        className,
      )}
    >
      <aside className="relative hidden h-full min-h-0 overflow-hidden surface-cream md:flex md:flex-col">
        {/* Soft ambient glow — same family as cream, no hard geometry */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/25 blur-3xl"
        />

        <div className="relative z-10 px-10 pt-10 lg:px-12 lg:pt-12">
          <Link
            to="/"
            className="text-2xl font-extrabold tracking-tight text-foreground"
          >
            alkemart<span className="text-primary">.</span>
          </Link>
          {caption ? (
            <p className="mt-2.5 text-sm font-medium text-foreground/70">
              {caption}
            </p>
          ) : null}
        </div>

        {/* Large art — fills most of the panel, no frame, seamless on cream */}
        <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-8 lg:px-10 lg:py-10">
          <picture className="block h-auto w-full max-w-[min(92%,42rem)]">
            <source srcSet={asset.src} type="image/webp" />
            <img
              src={asset.srcPng}
              alt=""
              width={450}
              height={450}
              decoding="async"
              fetchPriority="high"
              className="mx-auto h-auto w-full max-h-[min(78vh,40rem)] object-contain object-center"
              aria-hidden
            />
          </picture>
        </div>

        {brandFooter ? (
          <div className="relative z-10 px-10 pb-10 text-xs text-foreground/60 lg:px-12 lg:pb-12">
            {brandFooter}
          </div>
        ) : null}
      </aside>

      <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-background">
        {children}
      </div>
    </div>
  )
}
