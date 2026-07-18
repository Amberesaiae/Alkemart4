/**
 * Curated illustrations — imported so Vite always bundles them
 * (public/ alone can 404 after hot add on some WSL setups).
 */

import authBuyerPng from "@/assets/illustrations/auth-buyer.png"
import authBuyerWebp from "@/assets/illustrations/auth-buyer.webp"
import authSellerPng from "@/assets/illustrations/auth-seller.png"
import authSellerWebp from "@/assets/illustrations/auth-seller.webp"
import authAdminPng from "@/assets/illustrations/auth-admin.png"
import authAdminWebp from "@/assets/illustrations/auth-admin.webp"
import cashOnDeliveryPng from "@/assets/illustrations/cash-on-delivery.png"
import cashOnDeliveryWebp from "@/assets/illustrations/cash-on-delivery.webp"
import doorstepDeliveryPng from "@/assets/illustrations/doorstep-delivery.png"
import doorstepDeliveryWebp from "@/assets/illustrations/doorstep-delivery.webp"
import customerSupportPng from "@/assets/illustrations/customer-support.png"
import customerSupportWebp from "@/assets/illustrations/customer-support.webp"
import shoppingSalePng from "@/assets/illustrations/shopping-sale.png"
import shoppingSaleWebp from "@/assets/illustrations/shopping-sale.webp"
import addToCartPng from "@/assets/illustrations/add-to-cart.png"
import addToCartWebp from "@/assets/illustrations/add-to-cart.webp"
import emptyCartPng from "@/assets/illustrations/empty-cart.png"
import emptyCartWebp from "@/assets/illustrations/empty-cart.webp"
import emptyOrdersPng from "@/assets/illustrations/empty-orders.png"
import emptyOrdersWebp from "@/assets/illustrations/empty-orders.webp"
import emptyCatalogPng from "@/assets/illustrations/empty-catalog.png"
import emptyCatalogWebp from "@/assets/illustrations/empty-catalog.webp"
import deliveryPng from "@/assets/illustrations/delivery.png"
import deliveryWebp from "@/assets/illustrations/delivery.webp"
import paymentWalletPng from "@/assets/illustrations/payment-wallet.png"
import paymentWalletWebp from "@/assets/illustrations/payment-wallet.webp"
import securePaymentPng from "@/assets/illustrations/secure-payment.png"
import securePaymentWebp from "@/assets/illustrations/secure-payment.webp"
import marketplacePng from "@/assets/illustrations/marketplace.png"
import marketplaceWebp from "@/assets/illustrations/marketplace.webp"
import sellerHubPng from "@/assets/illustrations/seller-hub.png"
import sellerHubWebp from "@/assets/illustrations/seller-hub.webp"
import orderSuccessPng from "@/assets/illustrations/order-success.png"
import orderSuccessWebp from "@/assets/illustrations/order-success.webp"
import mobileShopPng from "@/assets/illustrations/mobile-shop.png"
import mobileShopWebp from "@/assets/illustrations/mobile-shop.webp"

export type IllustrationKey =
  | "authBuyer"
  | "authSeller"
  | "authAdmin"
  | "cashOnDelivery"
  | "doorstepDelivery"
  | "customerSupport"
  | "shoppingSale"
  | "addToCart"
  | "emptyCart"
  | "emptyOrders"
  | "emptyCatalog"
  | "delivery"
  | "paymentWallet"
  | "securePayment"
  | "marketplace"
  | "sellerHub"
  | "orderSuccess"
  | "mobileShop"

export type IllustrationAsset = {
  src: string
  srcPng: string
  alt: string
  width: number
  height: number
  style: "silhouette" | "lineart"
}

const SIZE = 450

function asset(
  webp: string,
  png: string,
  alt: string,
  style: "silhouette" | "lineart",
): IllustrationAsset {
  return { src: webp, srcPng: png, alt, width: SIZE, height: SIZE, style }
}

export const ILLUSTRATIONS: Record<IllustrationKey, IllustrationAsset> = {
  authBuyer: asset(authBuyerWebp, authBuyerPng, "Shop on alkemart", "silhouette"),
  /** Pack-6 imgi_170 doorstep */
  authSeller: asset(
    authSellerWebp,
    authSellerPng,
    "Doorstep delivery",
    "silhouette",
  ),
  /** Pack-6 imgi_171 headset */
  authAdmin: asset(authAdminWebp, authAdminPng, "Support headset", "silhouette"),
  cashOnDelivery: asset(
    cashOnDeliveryWebp,
    cashOnDeliveryPng,
    "Cash on delivery",
    "silhouette",
  ),
  doorstepDelivery: asset(
    doorstepDeliveryWebp,
    doorstepDeliveryPng,
    "Doorstep delivery",
    "silhouette",
  ),
  customerSupport: asset(
    customerSupportWebp,
    customerSupportPng,
    "Customer support",
    "silhouette",
  ),
  shoppingSale: asset(
    shoppingSaleWebp,
    shoppingSalePng,
    "Shopping sale",
    "silhouette",
  ),
  addToCart: asset(addToCartWebp, addToCartPng, "Add to cart", "silhouette"),
  emptyCart: asset(emptyCartWebp, emptyCartPng, "Empty cart", "lineart"),
  emptyOrders: asset(emptyOrdersWebp, emptyOrdersPng, "Orders", "lineart"),
  emptyCatalog: asset(
    emptyCatalogWebp,
    emptyCatalogPng,
    "Catalog",
    "lineart",
  ),
  delivery: asset(deliveryWebp, deliveryPng, "Delivery", "lineart"),
  paymentWallet: asset(
    paymentWalletWebp,
    paymentWalletPng,
    "Wallet",
    "lineart",
  ),
  securePayment: asset(
    securePaymentWebp,
    securePaymentPng,
    "Secure payment",
    "lineart",
  ),
  marketplace: asset(
    marketplaceWebp,
    marketplacePng,
    "Marketplace",
    "lineart",
  ),
  sellerHub: asset(sellerHubWebp, sellerHubPng, "Store management", "lineart"),
  orderSuccess: asset(
    orderSuccessWebp,
    orderSuccessPng,
    "Fast shipping",
    "lineart",
  ),
  mobileShop: asset(mobileShopWebp, mobileShopPng, "Mobile shopping", "lineart"),
}

export function illustration(key: IllustrationKey): IllustrationAsset {
  return ILLUSTRATIONS[key]
}
