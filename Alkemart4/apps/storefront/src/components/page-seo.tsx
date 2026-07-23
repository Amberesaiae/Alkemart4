import { useEffect } from "react"
import {
  applyPageSeo,
  setJsonLd,
  type PageSeo,
} from "@/lib/seo"

type Props = PageSeo & {
  jsonLd?: Record<string, unknown> | null
}

/**
 * Declarative SEO for a route — cleans up JSON-LD on unmount.
 * Does not invent commerce data; pass only API-backed fields.
 */
export function PageSeo({ jsonLd, ...seo }: Props) {
  useEffect(() => {
    applyPageSeo(seo)
    setJsonLd(jsonLd ?? null)
    return () => {
      setJsonLd(null)
    }
  }, [
    seo.title,
    seo.description,
    seo.path,
    seo.image,
    seo.noindex,
    seo.type,
    jsonLd,
  ])

  return null
}
