/**
 * Brand identity — text wordmark only (Admin / Seller Hub).
 */
export const brand = {
  name: "alkemart",
  wordmarkHtml: "alkemart",
  tagline: null as string | null,
  titleSuffix: "alkemart",
  description:
    "Multi-seller marketplace for Ghana — compare prices and pay cash on delivery.",
  faviconSrc: "/logo.svg",
  primary: "#F5C518",
  ink: "#141414",
} as const

export type Brand = typeof brand
