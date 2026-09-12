export type HomeTheme = "white" | "gold" | "black"

export type HomeLink = {
  label: string
  href: string
}

export type HomeTile = {
  id: string
  title: string
  eyebrow?: string
  body?: string
  imageUrl?: string
  href: string
}

export type HomeSection =
  | {
      id: string
      type: "promo_hero"
      eyebrow?: string
      title: string
      body?: string
      imageUrl?: string
      action?: HomeLink
      theme: HomeTheme
    }
  | {
      id: string
      type: "promo_grid"
      title?: string
      columns: 2 | 3 | 4
      theme: HomeTheme
      tiles: HomeTile[]
    }
  | {
      id: string
      type: "category_grid"
      title: string
      columns: 4 | 6 | 8
      categoryIds: string[]
    }
  | {
      id: string
      type: "product_shelf"
      title: string
      source: "featured" | "latest" | "category"
      categoryId?: string
      limit: 4 | 8 | 12
    }
  | {
      id: string
      type: "value_grid"
      title?: string
      items: Array<{ id: string; title: string; body: string }>
    }

export type HomepageDocument = {
  key: "homepage"
  revision: number
  sections: HomeSection[]
  status: "draft" | "published" | "scheduled"
  publishAt: string | null
  unpublishAt: string | null
  updatedAt: string
}

export const DEFAULT_HOMEPAGE_SECTIONS: HomeSection[] = [
  {
    id: "categories",
    type: "category_grid",
    title: "Shop by category",
    columns: 4,
    categoryIds: [],
  },
  {
    id: "fresh-picks",
    type: "product_shelf",
    title: "Fresh picks",
    source: "featured",
    limit: 8,
  },
]
