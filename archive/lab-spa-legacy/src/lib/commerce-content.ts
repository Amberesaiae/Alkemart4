/**
 * Centralized storefront chrome content (Ghana buyer SPA).
 * Prefer API/CMS when available; these are single-source fallbacks.
 * Color scheme stays yellow / white / black (tokens in index.css).
 */
import { LIVE_CURRENCY_SYMBOL } from "./money";

/** Default department strip when categories API is empty. */
export const SITE_DEPARTMENTS = [
  "Grocery",
  "Beauty",
  "Fashion",
  "Phones",
  "Electronics",
  "Home",
  "Baby",
  "Health",
  "Sports",
  "Auto",
  "Deals",
] as const;

/**
 * Service menu — real routes only; seller ops → external Mercur via footer/header.
 */
export const SITE_SERVICE_GROUPS = [
  {
    category: "Shop by need",
    items: [
      { label: "Grocery", to: "/browse/grocery" },
      { label: "Beauty", to: "/browse/beauty" },
      { label: "Phones", to: "/browse/phones" },
      { label: "Fashion", to: "/browse/fashion" },
      { label: "Home", to: "/browse/home" },
    ],
  },
  {
    category: "Your account",
    items: [
      { label: "Orders", to: "/orders" },
      { label: "Lists", to: "/account/lists" },
      { label: "Addresses", to: "/account/addresses" },
    ],
  },
] as const;

/** PLP chips that navigate to real destinations. */
export const PLP_QUICK_FILTERS = [
  { label: "Deals", kind: "tag" as const, value: "deal" },
  { label: "Grocery", kind: "browse" as const, value: "grocery" },
  { label: "Beauty", kind: "browse" as const, value: "beauty" },
  { label: "Phones", kind: "browse" as const, value: "phones" },
  { label: "Fashion", kind: "browse" as const, value: "fashion" },
  { label: "Home", kind: "browse" as const, value: "home" },
] as const;

const S = LIVE_CURRENCY_SYMBOL;

export const PLP_FILTER_GROUPS = [
  {
    label: "Price",
    items: [
      `Under ${S}50`,
      `${S}50 – ${S}100`,
      `${S}100 – ${S}250`,
      `${S}250 – ${S}500`,
      `${S}500+`,
    ],
    clientFilter: true as const,
  },
  {
    label: "Brand",
    items: [] as string[],
    clientFilter: true as const,
  },
] as const;

/** Pickup locations — empty until a real stores API exists. */
export const PICKUP_STORES: readonly string[] = [];

export const PAGE_SIZE_PLP = 24;

export const HELP_TOPICS = [
  "Orders",
  "Returns",
  "Payments",
  "Delivery",
  "Account",
] as const;

export const HELP_FAQ = [
  {
    q: "How does delivery work?",
    a: "Delivery options depend on your area in Ghana and the seller. You’ll see available windows and fees at checkout before you pay.",
    topics: ["Delivery", "Orders"],
  },
  {
    q: "Which payment methods are supported?",
    a: "This lab build supports cash on delivery. Mobile Money via Paystack is unfinished and only appears if lab mode is explicitly enabled.",
    topics: ["Payments"],
  },
  {
    q: "How do I return an item?",
    a: "Self-serve returns are not productized in this lab. Contact support with your lab order reference if you need help.",
    topics: ["Returns", "Orders"],
  },
  {
    q: "How do I sell on alkemart?",
    a: "Open the Mercur Seller Hub (Sell on alkemart) to register. Seller tools are not inside the buyer storefront.",
    topics: ["Account"],
  },
] as const;

/** Trust chips under the header (copy only; no fake eligibility logic). */
export const HEADER_TRUST_CHIPS = [
  "Lab demo",
  "Cash on delivery",
  "GHS prices",
  "Ghana delivery",
] as const;

/** Footer columns — SPA routes only (external sell link rendered in footer component). */
export const FOOTER_COLUMNS = [
  {
    title: "Shop",
    links: [
      { label: "Browse all", to: "/browse/all" },
      { label: "Grocery", to: "/browse/grocery" },
      { label: "Beauty", to: "/browse/beauty" },
      { label: "Help Center", to: "/help" },
    ],
  },
  {
    title: "Your account",
    links: [
      { label: "Your account", to: "/account" },
      { label: "Orders", to: "/orders" },
      { label: "Lists", to: "/account/lists" },
      { label: "Addresses", to: "/account/addresses" },
    ],
  },
  {
    title: "Customer service",
    links: [
      { label: "Message support", to: "/support" },
      { label: "Terms of Use", to: "/terms" },
      { label: "Privacy Notice", to: "/privacy" },
    ],
  },
] as const;

export function labelToSlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Price band labels for PLP client filters (uses live symbol). */
export function plpPriceBandMatchers(symbol = S): {
  label: string;
  test: (major: number) => boolean;
}[] {
  return [
    { label: `Under ${symbol}50`, test: (p) => p < 50 },
    { label: `${symbol}50 – ${symbol}100`, test: (p) => p >= 50 && p <= 100 },
    { label: `${symbol}100 – ${symbol}250`, test: (p) => p >= 100 && p <= 250 },
    { label: `${symbol}250 – ${symbol}500`, test: (p) => p >= 250 && p <= 500 },
    { label: `${symbol}500+`, test: (p) => p > 500 },
  ];
}
