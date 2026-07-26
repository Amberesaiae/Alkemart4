import { useState, type FormEvent } from "react"
import { useNavigate } from "@tanstack/react-router"
import { IconSafe } from "@/design/icons"
import { POPULAR_SEARCHES } from "@/lib/popular-searches"
import { useSearchHistory } from "@/lib/search-history"

export function SearchHero() {
  const navigate = useNavigate()
  const [q, setQ] = useState("")
  const { recent, frequent, trackSearch, removeQuery } = useSearchHistory()

  function submit(e: FormEvent) {
    e.preventDefault()
    const query = q.trim()
    if (!query) return
    trackSearch(query)
    void navigate({ to: "/search", search: { q: query } })
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        <form onSubmit={submit} role="search" aria-label="Site search" className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[ink]/60">
            <IconSafe name="search" size={20} />
          </span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search rice, phones, fashion, shops…"
            className="h-14 w-full rounded-full border-2 border-[ink]/20 bg-white py-2 pl-12 pr-6 text-base text-[ink] outline-none placeholder:text-[ink]/40 focus:border-[ink]/60 focus-visible:ring-2 focus-visible:ring-[ink]/30"
            aria-label="Search products"
            autoFocus
            autoComplete="off"
            enterKeyHint="search"
          />
        </form>

        {recent.length > 0 && (
          <section className="mt-6" aria-label="Recent searches">
            <h2 className="text-sm font-bold text-[ink]/70">Recent</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {recent.map((term) => (
                <span
                  key={term}
                  className="inline-flex items-center gap-1 rounded-full border border-[ink]/20 bg-white/80 px-3 py-1.5 text-sm text-[ink]"
                >
                  <button
                    type="button"
                    onClick={() => { void navigate({ to: "/search", search: { q: term } }) }}
                    className="min-h-11 font-medium"
                  >
                    {term}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeQuery(term)}
                    className="ml-1 inline-flex min-h-11 min-w-11 items-center justify-center text-[ink]/50 hover:text-[ink]"
                    aria-label={`Remove ${term}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="mt-6" aria-label="Popular searches">
          <h2 className="text-sm font-bold text-[ink]/70">Popular now</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {(frequent.length > 0 ? frequent.slice(0, 8) : POPULAR_SEARCHES).map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => { void navigate({ to: "/search", search: { q: term } }) }}
                className="min-h-11 rounded-full border border-[ink]/20 bg-white/80 px-3 py-1.5 text-sm font-medium text-[ink] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[ink]/30"
              >
                {term}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
