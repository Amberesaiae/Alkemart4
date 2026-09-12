export const brand = {
  name: "alkemart",
  wordmarkHtml: "alkemart",
  tagline: null as string | null,
  titleSuffix: "alkemart",
  description:
    "Multi-seller marketplace for Ghana — compare prices and pay cash on delivery.",
  faviconSrc: "/logo.svg",
  primary: "#FFC400",
  ink: "#000000",
} as const

export type Brand = typeof brand
