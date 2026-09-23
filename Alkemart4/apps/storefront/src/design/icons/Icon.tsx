import { useState } from "react"
import type { Icon as PhosphorIcon } from "@phosphor-icons/react"
import {
  Baby,
  Basket,
  BookmarkSimple,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  Check,
  Coffee,
  DeviceMobile,
  Globe,
  HandSoap,
  Heart,
  House,
  List,
  ListBullets,
  MagnifyingGlass,
  MapPin,
  Money,
  Package,
  PawPrint,
  Pill,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  SquaresFour,
  Star,
  StarHalf,
  Truck,
  TShirt,
  User,
  Wallet,
  X,
  Lightning,
} from "@phosphor-icons/react"
import type { IconId } from "./types"
import { cn } from "@/lib/utils"

const MAP: Record<IconId, PhosphorIcon> = {
  // Category rail
  "cat-electronics": DeviceMobile,
  "cat-food": Basket,
  "cat-beverages": Coffee,
  "cat-personal-care": HandSoap,
  "cat-pet-care": PawPrint,
  "cat-baby": Baby,
  "cat-fashion": TShirt,
  "cat-home": House,
  "cat-health": Pill,
  "cat-all": SquaresFour,
  // Chrome
  search: MagnifyingGlass,
  cart: ShoppingCart,
  user: User,
  heart: Heart,
  bookmark: BookmarkSimple,
  globe: Globe,
  menu: List,
  "chevron-right": CaretRight,
  "chevron-left": CaretLeft,
  "chevron-down": CaretDown,
  "chevron-up": CaretUp,
  close: X,
  // Commerce
  "add-cart": ShoppingBag,
  star: Star,
  "star-half": StarHalf,
  "star-empty": Star,
  "filter-grid": SquaresFour,
  "filter-list": ListBullets,
  delivery: Package,
  package: Package,
  location: MapPin,
  payment: Wallet,
  check: Check,
  // Trust / home bands
  truck: Truck,
  world: Globe,
  secure: ShieldCheck,
  cod: Money,
  wallet: Wallet,
  flash: Lightning,
  // Food Delivery icon pack — Phosphor fallbacks (webp renders first)
  "delivery-truck": Truck,
  "delivery-moto": Truck,
  "delivery-bike": Truck,
  "delivery-van": Truck,
  "delivery-scheduled": Truck,
  "delivery-fast": Truck,
  "delivery-handoff": Package,
  "delivery-location": MapPin,
  "delivery-person": Package,
  "order-bag": ShoppingBag,
  "order-bag-food": ShoppingBag,
  "order-takeout": ShoppingBag,
  "order-takeout-box": ShoppingBag,
  "order-container": Package,
  "order-hot": Package,
  "order-food-bag": ShoppingBag,
  "order-app": DeviceMobile,
  "order-phone": DeviceMobile,
  receipt: Money,
  "payment-cash": Money,
  "promo-food": Money,
}

/**
 * Icon IDs whose /icons/mowafer/{id}.webp asset is a verified semantic match.
 * Everything else falls back to the Phosphor glyph.
 *
 * Excluded (misnamed or raster-background quality issues):
 *   truck/delivery/package → wrong image (video camera / baby bodysuit)
 *   flash → ticket icon, not lightning
 *   cart/add-cart → raster with checkered background
 *   cat-beverages → shows a medicine bottle (semantically health, not drinks)
 *   cat-health → shows a baby bottle (semantically baby, not health)
 *   cat-all/filter-grid/world/user/heart → Phosphor equivalents are cleaner
 */
const WEBP_IDS = new Set<IconId>([
  // Category rail — visually confirmed
  "cat-food",          // ladle + spatula ✓
  "cat-electronics",   // laptop ✓
  "cat-fashion",       // T-shirt ✓
  "cat-home",          // armchair ✓
  "cat-personal-care", // nail polish + mascara ✓
  "cat-baby",          // baby bodysuit ✓
  "cat-pet-care",      // paw print ✓
  // Commerce / trust — visually confirmed
  "cod",               // banknotes stack ✓
  "secure",            // shield with keyhole ✓
  "wallet",            // physical wallet ✓
  "location",          // map pin ✓
  // Food Delivery icon pack — all 21 confirmed lineal icons
  "delivery-truck",    // fast food truck with speed lines ✓
  "delivery-moto",     // scooter/moped with box ✓
  "delivery-bike",     // motorbike side view ✓
  "delivery-van",      // food van with fork+knife ✓
  "delivery-scheduled",// truck with clock ✓
  "delivery-fast",     // fast food cloche with speed lines ✓
  "delivery-handoff",  // hand receiving package ✓
  "delivery-location", // map pin with food cloche ✓
  "delivery-person",   // person handing over a box ✓
  "order-bag",         // paper takeout bag ✓
  "order-bag-food",    // shopping bag with food cloche ✓
  "order-takeout",     // takeout box with skewer ✓
  "order-takeout-box", // takeout bag with kebab ✓
  "order-container",   // food takeout container ✓
  "order-hot",         // stacked hot food trays ✓
  "order-food-bag",    // shopping bag with chicken leg ✓
  "order-app",         // phone with food app ✓
  "order-phone",       // phone + food order chat ✓
  "receipt",           // receipt with dollar sign ✓
  "payment-cash",      // cash banknotes ✓
  "promo-food",        // food discount coupon ✓
])


type Props = {
  name: IconId
  size?: number
  className?: string
  /** Kept for API compatibility. */
  preferAsset?: boolean
  title?: string
  /** Phosphor weight; defaults to regular. */
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"
}

function renderPhosphor(
  name: IconId,
  size: number,
  className?: string,
  title?: string,
  weight: Props["weight"] = "regular",
) {
  const Cmp = MAP[name] ?? SquaresFour
  return (
    <Cmp
      size={size}
      weight={name === "star-empty" ? "regular" : weight}
      className={cn("inline-block shrink-0", className)}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
    />
  )
}

/**
 * Renders the custom webp asset from /icons/mowafer/{name}.webp.
 * Falls back to the Phosphor glyph if the asset fails to load.
 */
function WebpIcon({ name, size = 22, className, title, weight }: Props) {
  const [failed, setFailed] = useState(false)
  if (failed) return renderPhosphor(name, size, className, title, weight)
  return (
    <img
      src={`/icons/mowafer/${name}.webp`}
      alt={title ?? ""}
      width={size}
      height={size}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
      loading="lazy"
      decoding="async"
      className={cn("inline-block shrink-0 object-contain", className)}
      onError={() => setFailed(true)}
    />
  )
}

/**
 * Primary icon primitive.
 * Prefers the custom webp asset when available; Phosphor otherwise.
 */
export function Icon({ name, size = 22, className, title, weight }: Props) {
  if (WEBP_IDS.has(name)) {
    return (
      <WebpIcon
        name={name}
        size={size}
        className={className}
        title={title}
        weight={weight}
      />
    )
  }
  return renderPhosphor(name, size, className, title, weight)
}

/** Same as Icon — kept for call-site compatibility. */
export function IconSafe(props: Props) {
  return <Icon {...props} />
}

/** Back-compat alias. */
export function IconFallback(props: Props) {
  return <Icon {...props} />
}

/** Flash/highlight glyph for promo and Last Offers accents. */
export function FlashIcon({
  size = 22,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <Lightning
      size={size}
      weight="fill"
      className={cn("inline-block shrink-0", className)}
      aria-hidden
    />
  )
}

