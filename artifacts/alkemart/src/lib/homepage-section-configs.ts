/**
 * Per-type Zod schemas for homepage section config objects.
 * These drive both admin-side form validation and serve as the single
 * source of truth for which fields each section type accepts.
 */
import { z } from "zod";

export const PRODUCT_TAGS = ["rollback", "clearance", "best", "popular", "new"] as const;
export type ProductTag = (typeof PRODUCT_TAGS)[number];

export const HERO_TONES = [
  "surface",
  "surface-strong",
  "muted",
  "secondary",
  "primary",
  "accent",
] as const;

// ─── Individual schemas ────────────────────────────────────────────────────

export const announcementYellowConfigSchema = z.object({
  headline: z.string().optional(),
});

export const heroConfigSchema = z.object({
  eyebrow: z.string().optional(),
  title: z.string().optional(),
  cta: z.string().optional(),
});

export const productRailConfigSchema = z.object({
  title: z.string().optional(),
  useRealData: z.boolean().optional(),
  tag: z.enum(PRODUCT_TAGS).optional(),
  count: z.coerce.number().int().min(1).max(24).optional(),
  columns: z.coerce.number().int().min(2).max(8).optional(),
  showAdd: z.boolean().optional(),
  linkTo: z.string().optional(),
});

export const featureItemSchema = z.object({
  id: z.string(),
  icon: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
});
export type FeatureItem = z.infer<typeof featureItemSchema>;

export const featureGridConfigSchema = z.object({
  items: z.array(featureItemSchema).optional(),
});

export const dealsGridConfigSchema = z.object({
  title: z.string().optional(),
  tag: z.enum(PRODUCT_TAGS).optional(),
  count: z.coerce.number().int().min(1).max(24).optional(),
  columns: z.coerce.number().int().min(2).max(8).optional(),
  showAdd: z.boolean().optional(),
});

export const categoryRowConfigSchema = z.object({
  title: z.string().optional(),
  linkTo: z.string().optional(),
  categoryIds: z.array(z.number()).optional(),
});

const themeFields = {
  theme: z.string().optional(),
  customBg: z.string().optional(),
  customFg: z.string().optional(),
};

export const bentoGridConfigSchema = z.object({
  ...themeFields,
  variant: z.enum(["with_rail"]).optional(),
  railTitle: z.string().optional(),
  railLinkTo: z.string().optional(),
  railCount: z.coerce.number().int().min(1).max(12).optional(),
  railColumns: z.coerce.number().int().min(2).max(6).optional(),
  showAdd: z.boolean().optional(),
});

export const videoGridConfigSchema = z.object({
  title: z.string().optional(),
  linkTo: z.string().optional(),
});

export const heroSplitConfigSchema = z.object({
  layout: z.enum(["hero_first", "rail_first"]).optional(),
  heroTone: z.enum(HERO_TONES).optional(),
  heroImagePosition: z.enum(["left", "right"]).optional(),
  heroEyebrow: z.string().optional(),
  heroTitle: z.string().optional(),
  ...themeFields,
  railTitle: z.string().optional(),
  railEyebrow: z.string().optional(),
  railLinkTo: z.string().optional(),
  railCount: z.coerce.number().int().min(1).max(12).optional(),
  railColumns: z.coerce.number().int().min(2).max(6).optional(),
  railTag: z.enum(PRODUCT_TAGS).optional(),
  showAdd: z.boolean().optional(),
});

export const expressBandConfigSchema = z.object({
  headline: z.string().optional(),
  subtext: z.string().optional(),
});

// ─── Registry ─────────────────────────────────────────────────────────────

export const SECTION_CONFIG_SCHEMAS = {
  announcement_yellow: announcementYellowConfigSchema,
  hero: heroConfigSchema,
  product_rail: productRailConfigSchema,
  feature_grid: featureGridConfigSchema,
  deals_grid: dealsGridConfigSchema,
  category_row: categoryRowConfigSchema,
  bento_grid: bentoGridConfigSchema,
  video_grid: videoGridConfigSchema,
  hero_split: heroSplitConfigSchema,
  express_band: expressBandConfigSchema,
} as const;

export type SectionConfigSchemaKey = keyof typeof SECTION_CONFIG_SCHEMAS;
