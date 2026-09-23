import { useState } from "react"

function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 2a8 8 0 1 1-4.1 14.9l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 0 1 12 4Zm-3.2 3.9c-.2 0-.5 0-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1.1 2.7c.1.2 1.9 3 4.7 4 .6.3 1.1.4 1.5.5.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3l-2-1c-.2-.1-.4-.1-.6.1l-.9 1.1c-.1.2-.3.2-.5.1a7.6 7.6 0 0 1-2.2-1.4 8.2 8.2 0 0 1-1.5-1.9c-.2-.3 0-.4.1-.6l.5-.6c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5L8.9 8c-.1-.3-.4-.4-.9-.4Z" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.7c0-.9.3-1.6 1.6-1.6h1.7V4.2c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.4H7.4V14h2.7v8h3.4Z" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.7 3H21l-7.3 8.3L22 21h-6.8l-5.3-6.2L3.8 21H.5l7.8-8.9L0 3h7l4.8 5.7L17.7 3Zm-1.2 16h1.9L6.6 4.9H4.6L16.5 19Z" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
    </svg>
  )
}

/**
 * Share row for the PDP. Native share sheet first; WhatsApp / X / Facebook
 * intent links carry the real canonical URL — no shorteners, no trackers.
 */
export function PdpShareRow({ title, url }: { title: string; url: string }) {
  const [note, setNote] = useState<string | null>(null)
  const encodedUrl = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(title)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setNote("Link copied")
      window.setTimeout(() => setNote(null), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }

  const native = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title, url })
        return
      }
    } catch {
      /* dismissed — fall through to copy */
    }
    await copy()
  }

  const linkClass =
    "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border bg-card px-3 text-sm font-bold text-muted-foreground transition hover:border-primary/60 hover:text-foreground"

  return (
    <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <span className="font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">
          Share:
        </span>
        <a
          href={`https://wa.me/?text=${encodedTitle}%20${encodedUrl}`}
          target="_blank"
          rel="noreferrer"
          aria-label="Share on WhatsApp"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition hover:border-primary hover:text-foreground"
        >
          <WhatsAppIcon />
        </a>
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
          target="_blank"
          rel="noreferrer"
          aria-label="Share on Facebook"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition hover:border-primary hover:text-foreground"
        >
          <FacebookIcon />
        </a>
        <a
          href={`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`}
          target="_blank"
          rel="noreferrer"
          aria-label="Share on X"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition hover:border-primary hover:text-foreground"
        >
          <XIcon />
        </a>
        <button
          type="button"
          onClick={native}
          aria-label="Copy product link"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition hover:border-primary hover:text-foreground"
        >
          <LinkIcon />
        </button>
        {note ? (
          <span role="status" className="text-xs font-semibold text-tone-brand-ink ml-1">
            {note}
          </span>
        ) : null}
      </div>
    </div>
  )
}
