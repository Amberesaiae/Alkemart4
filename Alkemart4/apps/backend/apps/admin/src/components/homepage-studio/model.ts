import type { HomeSection } from "@alkemart/shared/homepage"
import { categoryTilesOf } from "@alkemart/shared/homepage"
import {
  newSection,
  sectionAccents,
  sectionHints,
  sectionLabels,
  sectionPresets,
  SECTION_TYPES,
} from "./sections/registry"
export type { SectionPreset } from "./sections/registry"
export {
  newSection,
  sectionAccents,
  sectionHints,
  sectionLabels,
  sectionPresets,
  SECTION_TYPES,
}

export function sectionName(section: HomeSection): string {
  return "title" in section && section.title ? section.title : sectionLabels[section.type]
}

/** Storefront origin for the live preview iframe. Same default as local dev. */
export function storefrontBase(): string {
  const raw = (import.meta.env.VITE_ALKEMART_STOREFRONT_URL as string | undefined)?.trim()
  return (raw ? raw : "http://127.0.0.1:5175").replace(/\/$/, "")
}

export type SectionIssue = {
  sectionId: string
  message: string
}

function isInternalHref(value: string): boolean {
  const trimmed = value.trim()
  return trimmed.startsWith("/") && !trimmed.startsWith("//")
}

function imageIsValid(value: string | undefined): boolean {
  const trimmed = (value ?? "").trim()
  return trimmed === "" || trimmed.startsWith("/") || trimmed.startsWith("https://")
}

function checkLink(issues: SectionIssue[], sectionId: string, field: string, link: { label: string; href: string } | undefined) {
  if (!link) return
  if (!link.label.trim()) issues.push({ sectionId, message: `${field} needs button text, or remove the button.` })
  if (!isInternalHref(link.href)) issues.push({ sectionId, message: `${field} link must be an internal path starting with /.` })
}

function checkImage(issues: SectionIssue[], sectionId: string, value: string | undefined) {
  if (!imageIsValid(value)) issues.push({ sectionId, message: "Images must use HTTPS or an internal path starting with /." })
}

/**
 * Client mirror of the API's draft validation (`apps/api/src/routes/admin/homepage.ts`).
 *
 * Save/publish used to fail with a bare toast ("pick at least one category")
 * and no pointer to the offending section. Validate locally first so every
 * problem renders inline, on the section that caused it.
 */
export function validateSections(sections: HomeSection[]): SectionIssue[] {
  const issues: SectionIssue[] = []
  const seen = new Set<string>()
  sections.forEach((section) => {
    const id = section.id
    if (seen.has(id)) {
      issues.push({ sectionId: id, message: "Another section uses this ID — duplicate the section again to regenerate it." })
    } else {
      seen.add(id)
    }
    if (section.startsAt && section.endsAt && section.startsAt >= section.endsAt) {
      issues.push({ sectionId: id, message: "The stop date must be after the start date." })
    }

    if (section.type === "promo_hero" || section.type === "promo_band" || section.type === "countdown_banner") {
      if (!section.title.trim()) issues.push({ sectionId: id, message: "Add a title." })
      checkImage(issues, id, section.imageUrl)
      checkLink(issues, id, "Button", section.action)
    }
    if (section.type === "promo_band") {
      checkLink(issues, id, "Secondary button", section.secondaryAction)
    }
    if (section.type === "countdown_banner") {
      if (Number.isNaN(new Date(section.countdownTo).getTime())) issues.push({ sectionId: id, message: "Pick a valid countdown date." })
    }

    if (section.type === "promo_grid") {
      if (!section.tiles.length) issues.push({ sectionId: id, message: "Add at least one tile." })
      section.tiles.forEach((tile, index) => {
        const n = index + 1
        if (!tile.title.trim()) issues.push({ sectionId: id, message: `Tile ${n} needs a title.` })
        if (!tile.href.trim()) issues.push({ sectionId: id, message: `Tile ${n} needs a link.` })
        else if (!isInternalHref(tile.href)) issues.push({ sectionId: id, message: `Tile ${n} link must start with /.` })
        checkImage(issues, id, tile.imageUrl)
      })
    }

    if (section.type === "category_grid") {
      if (!section.title.trim()) issues.push({ sectionId: id, message: "Add a title." })
      if (!categoryTilesOf(section).length) issues.push({ sectionId: id, message: "Pick at least one category below." })
    }

    if (section.type === "product_shelf" || section.type === "deal_rail") {
      if (!section.title.trim()) issues.push({ sectionId: id, message: "Add a title." })
      if (section.source === "category" && !section.categoryId) {
        issues.push({ sectionId: id, message: "Choose a category for this product source." })
      }
      if (section.source === "manual" && !(section.productIds ?? []).length) {
        issues.push({ sectionId: id, message: "Add at least one product ID for manual picks." })
      }
      if (section.type === "product_shelf" && section.source === "daypart") {
        const parts = Object.values(section.daypartCategoryIds ?? {}).filter(Boolean)
        if (!parts.length) issues.push({ sectionId: id, message: "Pick a category for at least one part of the day." })
      }
    }
    if (section.type === "store_rail") {
      if (!section.title.trim()) issues.push({ sectionId: id, message: "Add a title." })
      if (section.source === "manual" && !(section.sellerHandles ?? []).length) {
        issues.push({ sectionId: id, message: "Add at least one shop handle for manual picks." })
      }
    }
    if (section.type === "deal_rail" && section.countdownTo && Number.isNaN(new Date(section.countdownTo).getTime())) {
      issues.push({ sectionId: id, message: "Fix the header clock date, or clear it." })
    }

    if (section.type === "marquee") {
      if (!section.items.length) issues.push({ sectionId: id, message: "Add at least one announcement." })
      section.items.forEach((item, index) => {
        const n = index + 1
        if (!item.label.trim()) issues.push({ sectionId: id, message: `Announcement ${n} needs text.` })
        if (item.href && !isInternalHref(item.href)) issues.push({ sectionId: id, message: `Announcement ${n} link must start with /.` })
      })
    }

    if (section.type === "value_grid") {
      if (section.items.length < 2) issues.push({ sectionId: id, message: "Value grids need at least 2 cards." })
      section.items.forEach((item, index) => {
        const n = index + 1
        if (!item.title.trim()) issues.push({ sectionId: id, message: `Card ${n} needs a title.` })
        if (!item.body.trim()) issues.push({ sectionId: id, message: `Card ${n} needs a description.` })
      })
    }
  })
  return issues
}


