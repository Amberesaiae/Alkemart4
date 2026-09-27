import { Link } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, Calendar03Icon, Location01Icon, PackageIcon } from "@hugeicons/core-free-icons"
import { Rating } from "@/components/commerce/rating"
import { SellerAvatar } from "@/components/commerce/seller-avatar"
import type { StoreVendorDetail } from "@/lib/vendors"

/** The shop behind the chosen offer — facts from the shop API only. */
export function SellerPanel({ vendor, productId, productTitle }: { vendor: StoreVendorDetail; productId?: string; productTitle?: string }) {
  const t = vendor.trust
  const paused = vendor.availability?.state === "paused"
  return (
    <div className="space-y-4 rounded-3xl border border-border p-5">
      <div className="flex items-center gap-3">
        <SellerAvatar name={vendor.name} logo={vendor.logoThumbUrl ?? vendor.logoImageUrl} size="lg" />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">About this shop</p>
          <p className="truncate font-bold">{vendor.name}</p>
          <Rating avg={t?.ratingAvg} count={t?.ratingCount} />
        </div>
      </div>
      {paused ? (
        <p className="rounded-2xl bg-muted px-3 py-2 text-sm">
          This shop is paused{vendor.availability?.note ? ` — ${vendor.availability.note}` : ""}.
          {vendor.availability?.pausedUntil
            ? ` Back ${new Date(vendor.availability.pausedUntil).toLocaleDateString()}.`
            : ""}
        </p>
      ) : null}
      <ul className="space-y-2 text-sm text-muted-foreground">
        {t?.location ? (
          <li className="flex items-center gap-2">
            <HugeiconsIcon icon={Location01Icon} className="size-4" /> {t.location}
          </li>
        ) : null}
        {t?.salesCount ? (
          <li className="flex items-center gap-2">
            <HugeiconsIcon icon={PackageIcon} className="size-4" /> {t.salesCount.toLocaleString()} orders fulfilled
          </li>
        ) : null}
        {t?.memberSince ? (
          <li className="flex items-center gap-2">
            <HugeiconsIcon icon={Calendar03Icon} className="size-4" /> Selling since{" "}
            {new Date(t.memberSince).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </li>
        ) : null}
      </ul>
      {t?.policy?.returnsDays != null || t?.policy?.warranty ? (
        <ul className="flex flex-wrap gap-1.5 text-xs">
          {t?.policy?.returnsDays != null ? (
            <li className="rounded-full bg-muted px-2.5 py-1">
              {t.policy.returnsDays > 0 ? `${t.policy.returnsDays}-day returns` : "No change-of-mind returns"}
            </li>
          ) : null}
          {t?.policy?.warranty ? <li className="rounded-full bg-muted px-2.5 py-1">{t.policy.warranty}</li> : null}
        </ul>
      ) : null}
      {vendor.replyTime?.label ? <p className="text-sm text-muted-foreground">{vendor.replyTime.label}</p> : null}
      <Link
        to="/messages/new"
        search={{ sellerId: vendor.id, ...(productId ? { productId } : {}), shop: vendor.name, ...(productTitle ? { about: productTitle } : {}) }}
        className="flex min-h-11 items-center justify-center rounded-full border border-border text-sm font-semibold hover:bg-muted"
      >
        Message the shop
      </Link>
      <Link
        to="/shops/$slug"
        params={{ slug: vendor.slug }}
        className="flex items-center justify-between rounded-full bg-surface px-4 py-2.5 text-sm font-semibold hover:bg-muted"
      >
        Visit store <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
      </Link>
    </div>
  )
}
