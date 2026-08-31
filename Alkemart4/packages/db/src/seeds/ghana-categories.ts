/** Ghana marketplace category seed rows. Stable ids = handles (no UUID DB needed). */
export type CategorySeedRow = {
  id: string
  handle: string
  name: string
  parentId: string | null
  rank: number
  isNav: boolean
}

const ROOTS: Array<{ handle: string; name: string; rank: number }> = [
  { handle: "food-groceries", name: "Food & Groceries", rank: 0 },
  { handle: "beverages", name: "Beverages", rank: 1 },
  { handle: "fashion-apparel", name: "Fashion & Apparel", rank: 2 },
  { handle: "phones-electronics", name: "Phones & Electronics", rank: 3 },
  { handle: "home-living", name: "Home & Living", rank: 4 },
  { handle: "health-beauty", name: "Health & Beauty", rank: 5 },
  { handle: "baby-kids", name: "Baby & Kids", rank: 6 },
  { handle: "pet-care", name: "Pet Care", rank: 7 },
  { handle: "agriculture", name: "Agriculture", rank: 8 },
  { handle: "automotive", name: "Automotive", rank: 9 },
  { handle: "services", name: "Services", rank: 10 },
  { handle: "other", name: "Other", rank: 11 },
]

const L2: Array<{ parent: string; handle: string; name: string; rank: number }> = [
  { parent: "phones-electronics", handle: "phones", name: "Phones", rank: 0 },
  { parent: "phones-electronics", handle: "accessories", name: "Accessories", rank: 1 },
  { parent: "phones-electronics", handle: "computing", name: "Computing", rank: 2 },
  { parent: "phones-electronics", handle: "tvs-audio", name: "TVs & Audio", rank: 3 },
  { parent: "fashion-apparel", handle: "men", name: "Men", rank: 0 },
  { parent: "fashion-apparel", handle: "women", name: "Women", rank: 1 },
  { parent: "fashion-apparel", handle: "kids", name: "Kids", rank: 2 },
  { parent: "fashion-apparel", handle: "shoes", name: "Shoes", rank: 3 },
  { parent: "fashion-apparel", handle: "bags", name: "Bags", rank: 4 },
  { parent: "food-groceries", handle: "staples", name: "Staples", rank: 0 },
  { parent: "food-groceries", handle: "cooking-oil", name: "Cooking Oil", rank: 1 },
  { parent: "food-groceries", handle: "snacks", name: "Snacks", rank: 2 },
]

export const GHANA_CATEGORY_SEED: CategorySeedRow[] = [
  ...ROOTS.map((r) => ({
    id: r.handle,
    handle: r.handle,
    name: r.name,
    parentId: null as string | null,
    rank: r.rank,
    isNav: true,
  })),
  ...L2.map((c) => ({
    id: c.handle,
    handle: c.handle,
    name: c.name,
    parentId: c.parent,
    rank: c.rank,
    isNav: true,
  })),
]
