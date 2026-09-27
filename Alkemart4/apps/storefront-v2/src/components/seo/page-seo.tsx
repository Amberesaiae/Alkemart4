import { useEffect } from "react"
import { applyPageSeo, setJsonLd, type PageSeo as PageSeoInput } from "@/lib/seo"

export function PageSeo(props: PageSeoInput & { jsonLd?: Record<string, unknown> | null }) {
  const { jsonLd, ...seo } = props
  const key = JSON.stringify(seo)
  useEffect(() => {
    applyPageSeo(seo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const ld = jsonLd ? JSON.stringify(jsonLd) : null
  useEffect(() => {
    setJsonLd(ld ? (JSON.parse(ld) as Record<string, unknown>) : null)
    return () => setJsonLd(null)
  }, [ld])
  return null
}
