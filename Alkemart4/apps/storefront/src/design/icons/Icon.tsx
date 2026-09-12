import type { Icon as PhosphorIcon } from "@phosphor-icons/react"
import {
  Baby,
  Basket,
  BookmarkSimple,
  CaretRight,
  Check,
  Coffee,
  DeviceMobile,
  Globe,
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
  Sparkle,
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
  "cat-personal-care": Sparkle,
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
}

type Props = {
  name: IconId
  size?: number
  className?: string
  /** Kept for API compatibility — icons are Phosphor throughout. */
  preferAsset?: boolean
  title?: string
  /** Phosphor weight; defaults to regular line icons. */
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"
}

function render(
  name: IconId,
  size: number,
  className?: string,
  title?: string,
  weight: Props["weight"] = "regular",
) {
  const Cmp = MAP[name]
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
 * Icon primitive — Phosphor throughout the storefront.
 * Same props as before so every call site works unchanged.
 */
export function Icon({ name, size = 22, className, title, weight }: Props) {
  return render(name, size, className, title, weight)
}

/** Same as Icon — every glyph resolves, no asset fallbacks. */
export function IconSafe(props: Props) {
  const { size = 22, className, name, title, weight } = props
  return render(name, size, className, title, weight)
}

/** Back-compat alias — renders the Phosphor glyph directly. */
export function IconFallback(props: Props) {
  const { size = 22, className, name, title, weight } = props
  return render(name, size, className, title, weight)
}

/** Flash/highlight glyph for promo and Last Offers accents. */
export function FlashIcon({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <Lightning
      size={size}
      weight="fill"
      className={cn("inline-block shrink-0", className)}
      aria-hidden
    />
  )
}
