import { useState } from "react"
import { Button, StudioImageField } from "@workspace/ui"
import { toast } from "sonner"
import { products as productsApi } from "../lib/api"
import { useSellerProfile, useUpdateSeller } from "../lib/hooks"

/**
 * Shop cover and logo.
 *
 * One implementation, rendered in two places on purpose: the Branding tab,
 * where a seller looks for "where do I put my shop picture", and the Shop
 * window beat in the Studio, where art is edited next to a live preview.
 *
 * It previously existed only in the Studio — four levels deep, under
 * "Catalog & Display" — while the Branding tab offered tagline, bio and SEO
 * and no images at all. Not one live seller had a cover or logo set. A control
 * nobody can find is the same as a control that does not exist.
 */
export function ShopArtEditor({ compact = false }: { compact?: boolean }) {
  const { data } = useSellerProfile()
  const update = useUpdateSeller()
  const seller = data?.seller

  // `undefined` means untouched, `null` means explicitly cleared — the two
  // must stay distinct so saving does not wipe art the seller never edited.
  const [banner, setBanner] = useState<string | null | undefined>(undefined)
  const [logo, setLogo] = useState<string | null | undefined>(undefined)
  const bannerValue = banner === undefined ? seller?.banner ?? "" : banner ?? ""
  const logoValue = logo === undefined ? seller?.logo ?? "" : logo ?? ""
  const dirty = banner !== undefined || logo !== undefined

  const upload = (file: File) => productsApi.upload(file)

  const save = async () => {
    try {
      await update.mutateAsync({
        banner: banner !== undefined ? banner : undefined,
        logo: logo !== undefined ? logo : undefined,
      })
      setBanner(undefined)
      setLogo(undefined)
      toast.success("Shop art saved.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save art.")
    }
  }

  return (
    <div className={compact ? "flex flex-col gap-4" : "flex flex-col gap-4 p-4"}>
      {compact ? null : <p className="text-sm font-extrabold">Cover & logo</p>}
      <p className="text-xs text-muted-foreground">
        Art only — no text on the photo. Your shop name is the caption, below it.
      </p>
      <StudioImageField
        label="Cover photo"
        ratio="landscape"
        value={bannerValue}
        onValueChange={(value) => setBanner(value || null)}
        onUpload={upload}
      />
      <StudioImageField
        label="Logo"
        ratio="square"
        value={logoValue}
        onValueChange={(value) => setLogo(value || null)}
        onUpload={upload}
      />
      <Button
        type="button"
        className="self-start"
        disabled={!dirty || update.isPending}
        onClick={() => void save()}
      >
        {update.isPending ? "Saving…" : "Save art"}
      </Button>
    </div>
  )
}
