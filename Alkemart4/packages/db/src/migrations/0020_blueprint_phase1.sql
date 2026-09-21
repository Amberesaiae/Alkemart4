-- Blueprint Phase 1A/1B/1C/1D + 3A + 4A foundations.
-- Idempotent (IF NOT EXISTS / duplicate_object guards) so it is safe to run
-- on databases at any earlier migration level, matching 0019 convention.
-- New columns are nullable or defaulted; legacy readers are unaffected.

-- ── Enums ──
DO $$ BEGIN CREATE TYPE taxonomy_status AS ENUM('proposed', 'active', 'deprecated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE identity_confidence AS ENUM('identified', 'matched', 'seller_specific'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE attribute_type AS ENUM('text', 'number', 'boolean', 'option', 'multi_option'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE match_candidate_status AS ENUM('proposed', 'confirmed', 'rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE collection_visibility AS ENUM('draft', 'published'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 1A: taxonomy lifecycle on categories ──
ALTER TABLE categories ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS level integer NOT NULL DEFAULT 0;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS status taxonomy_status NOT NULL DEFAULT 'active';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_browseable boolean NOT NULL DEFAULT true;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_assignable boolean NOT NULL DEFAULT true;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_nav_visible boolean NOT NULL DEFAULT true;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS attribute_profile_id text;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS replacement_node_id text REFERENCES categories(id);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

-- ── 1B: product identity (ADR-002) ──
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS gtin text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS mpn text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS manufacturer text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS identity_confidence identity_confidence NOT NULL DEFAULT 'seller_specific';
ALTER TABLE products ADD COLUMN IF NOT EXISTS identity_provenance jsonb;

ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS weight_grams integer;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS gtin text;

-- ── 3A: offer terms ──
ALTER TABLE offers ADD COLUMN IF NOT EXISTS condition text;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS compare_at_pesewas bigint;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS compare_at_provenance text;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS fulfillment_origin text;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS warranty_ref text;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS returns_ref text;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS delivery_promise text;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS freshness_at timestamptz;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- ── 1C: typed attributes ──
CREATE TABLE IF NOT EXISTS attribute_definitions (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  type attribute_type NOT NULL,
  unit_family text,
  allowed_values jsonb,
  filterable boolean NOT NULL DEFAULT false,
  searchable boolean NOT NULL DEFAULT false,
  required boolean NOT NULL DEFAULT false,
  variant_axis boolean NOT NULL DEFAULT false,
  visible_on_card boolean NOT NULL DEFAULT false,
  visible_on_pdp boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS attribute_profiles (
  id text PRIMARY KEY,
  name text NOT NULL,
  category_id text,
  version integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS profile_attributes (
  id text PRIMARY KEY,
  profile_id text NOT NULL REFERENCES attribute_profiles(id),
  definition_id text NOT NULL REFERENCES attribute_definitions(id),
  position integer NOT NULL DEFAULT 0,
  required boolean NOT NULL DEFAULT false,
  UNIQUE (profile_id, definition_id)
);

CREATE TABLE IF NOT EXISTS product_attribute_values (
  id text PRIMARY KEY,
  product_id text NOT NULL REFERENCES products(id),
  definition_id text NOT NULL REFERENCES attribute_definitions(id),
  text_value text,
  number_value double precision,
  boolean_value boolean,
  option_values jsonb,
  unit text,
  UNIQUE (product_id, definition_id)
);

-- ── 1D: match candidates ──
CREATE TABLE IF NOT EXISTS product_match_candidates (
  id text PRIMARY KEY,
  product_id text NOT NULL REFERENCES products(id),
  candidate_product_id text NOT NULL REFERENCES products(id),
  source text NOT NULL,
  evidence jsonb,
  status match_candidate_status NOT NULL DEFAULT 'proposed',
  reviewer_id text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 4A: vendor collections (ADR-003) ──
CREATE TABLE IF NOT EXISTS collections (
  id text PRIMARY KEY,
  seller_id text NOT NULL REFERENCES sellers(id),
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  image_url text,
  visibility collection_visibility NOT NULL DEFAULT 'draft',
  position integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS collection_products (
  id text PRIMARY KEY,
  collection_id text NOT NULL REFERENCES collections(id),
  product_id text NOT NULL REFERENCES products(id),
  position integer NOT NULL DEFAULT 0,
  UNIQUE (collection_id, product_id)
);
