export const brand = {
  name: "alkemart",
  wordmarkHtml: "alkemart",
  tagline: null as string | null,
  titleSuffix: "alkemart",
  description:
    "Multi-seller marketplace for Ghana — compare prices and pay cash on delivery.",
  faviconSrc: "/logo.svg",
  primary: "#FEBF31",
  ink: "#1a1a1a",
} as const

export type Brand = typeof brand
