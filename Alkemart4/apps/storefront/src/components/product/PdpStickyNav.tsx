import { useState, useEffect } from "react"
import {
  CaretRight,
  ChatsCircle,
  ChatTeardropText,
  FileText,
  ListBullets,
  ShoppingCart,
} from "@phosphor-icons/react"
import { Price } from "@/components/price"

interface PdpStickyNavProps {
  product: {
    id: string
    title: string
    thumbnail: string | null
    amount: number | null
    currencyCode: string | null
  }
  canAdd: boolean
  isPending: boolean
  onAddToCart: () => void
  sellerName?: string | null
  sellerHandle?: string | null
  /** Real WhatsApp contact from the shop profile; null when undeclared. */
  sellerWhatsApp?: string | null
}

export function PdpStickyNav({
  product,
  canAdd,
  isPending,
  onAddToCart,
  sellerName,
  sellerHandle,
  sellerWhatsApp,
}: PdpStickyNavProps) {
  const [activeSection, setActiveSection] = useState<string>("product-details")

  useEffect(() => {
    const handleScroll = () => {
      const sections = ["product-details", "specifications", "buyer-reviews"]
      for (const id of sections) {
        const el = document.getElementById(id)
        if (el) {
          const rect = el.getBoundingClientRect()
          if (rect.top <= 160 && rect.bottom >= 160) {
            setActiveSection(id)
            break
          }
        }
      }
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <div className="sticky top-20 space-y-4">
      {/* Jump Links Card */}
      <nav
        aria-label="Product sections"
        className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-2xs"
      >
        <ul className="divide-y divide-border/60 text-xs font-semibold">
          <li>
            <button
              type="button"
              onClick={() => scrollTo("product-details")}
              className={
                "flex w-full items-center justify-between px-3.5 py-3 text-left  hover:bg-muted/50 " +
                (activeSection === "product-details"
                  ? "text-primary font-bold bg-muted"
                  : "text-foreground")
              }
            >
              <span className="flex items-center gap-2">
                <FileText size={16} className="text-muted-foreground shrink-0" />
                <span>Product details</span>
              </span>
              <CaretRight size={14} className="text-muted-foreground" />
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => scrollTo("specifications")}
              className={
                "flex w-full items-center justify-between px-3.5 py-3 text-left  hover:bg-muted/50 " +
                (activeSection === "specifications"
                  ? "text-primary font-bold bg-muted"
                  : "text-foreground")
              }
            >
              <span className="flex items-center gap-2">
                <ListBullets size={16} className="text-muted-foreground shrink-0" />
                <span>Specifications</span>
              </span>
              <CaretRight size={14} className="text-muted-foreground" />
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => scrollTo("buyer-reviews")}
              className={
                "flex w-full items-center justify-between px-3.5 py-3 text-left  hover:bg-muted/50 " +
                (activeSection === "buyer-reviews"
                  ? "text-primary font-bold bg-muted"
                  : "text-foreground")
              }
            >
              <span className="flex items-center gap-2">
                <ChatTeardropText size={16} className="text-muted-foreground shrink-0" />
                <span>Customer Reviews</span>
              </span>
              <CaretRight size={14} className="text-muted-foreground" />
            </button>
          </li>
        </ul>
      </nav>

      {/* Mini Buy Card */}
      <div className="rounded-lg border border-border/80 bg-card p-4 shadow-2xs space-y-3">
        <div className="flex gap-3 items-center">
          {product.thumbnail ? (
            <img
              src={product.thumbnail}
              alt=""
              aria-hidden
              className="h-12 w-12 shrink-0 rounded-lg object-contain bg-background border border-border/70 p-1"
            />
          ) : (
            <div className="h-12 w-12 shrink-0 rounded-lg bg-muted border border-border/70 flex items-center justify-center text-xs text-muted-foreground">
              📦
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 text-xs font-bold text-foreground">
              {product.title}
            </p>
            <Price
              amount={product.amount}
              currencyCode={product.currencyCode}
              size="sm"
              className="font-black text-foreground"
            />
          </div>
        </div>

        <button
          type="button"
          disabled={!canAdd || isPending}
          onClick={onAddToCart}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-black uppercase tracking-wider text-primary-foreground shadow-2xs  hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ShoppingCart size={16} weight="bold" />
          <span>{isPending ? "Adding…" : "Add to cart"}</span>
        </button>

        {sellerName ? (
          sellerWhatsApp ? (
            <a
              href={`https://wa.me/${encodeURIComponent(sellerWhatsApp)}?text=${encodeURIComponent(`Hello ${sellerName}, I have a question about "${product.title}" on alkemart.`)}`}
              target="_blank"
              rel="noreferrer"
              className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-border/80 bg-background px-3 text-xs font-bold text-foreground  hover:bg-muted"
            >
              <ChatsCircle size={16} weight="bold" className="text-primary" />
              <span>Chat with seller</span>
            </a>
          ) : sellerHandle ? (
            <a
              href={`/shops/${encodeURIComponent(sellerHandle)}`}
              className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-border/80 bg-background px-3 text-xs font-bold text-foreground  hover:bg-muted"
            >
              <ChatsCircle size={16} weight="bold" className="text-primary" />
              <span>Ask the seller</span>
            </a>
          ) : null
        ) : null}
      </div>
    </div>
  )
}
