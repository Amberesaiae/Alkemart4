/** Storefront-only artwork. Do not change admin studio presets with this map. */
const DEPARTMENT_ART: Record<string, string> = {
  "phones-electronics": "/images/departments/reference-electronics-v1.webp",
  "fashion-apparel": "/images/departments/reference-fashion-v2.webp",
  "home-living": "/images/departments/reference-home-v1.webp",
  "health-beauty": "/images/departments/reference-beauty-v1.webp",
  "baby-kids": "/images/departments/baby-kids-v1.webp",
  "food-groceries": "/images/departments/food-groceries-v1.webp",
  agriculture: "/images/departments/agriculture-v1.webp",
  automotive: "/images/departments/automotive-v1.webp",
  beverages: "/images/departments/beverages-v1.webp",
  other: "/images/departments/other-v1.webp",
  "pet-care": "/images/departments/pet-care-v1.webp",
  services: "/images/departments/services-v1.webp",
  "tools-hardware": "/images/departments/tools-hardware-v1.webp",
}

export function departmentArtFor(handle?: string | null) {
  return handle ? DEPARTMENT_ART[handle.toLowerCase()] : undefined
}
