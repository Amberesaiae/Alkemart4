-- Blueprint Phase 6E — editorial guides (hub-and-spoke buying advice).
-- Idempotent (IF NOT EXISTS / duplicate_object guards).

DO $$ BEGIN CREATE TYPE guide_status AS ENUM('draft', 'published'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS guides (
  slug text PRIMARY KEY,
  title text NOT NULL,
  excerpt text NOT NULL,
  author text NOT NULL,
  status guide_status NOT NULL DEFAULT 'draft',
  revision integer NOT NULL DEFAULT 1,
  sections jsonb NOT NULL DEFAULT '[]',
  related_guides jsonb NOT NULL DEFAULT '[]',
  refresh_after timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Pilot cluster: Ghana phone buying advice. Prose carries no prices, stock
-- figures, or product IDs — picks resolve live catalog queries at serve
-- time, so advice cannot go stale.
INSERT INTO guides (slug, title, excerpt, author, status, revision, sections, related_guides, refresh_after, published_at) VALUES
(
  'buying-a-phone-in-ghana',
  'Buying a phone in Ghana: what actually matters',
  'Network bands, dual SIM, battery life, and how to read seller offers before you pay.',
  'Alkemart editorial',
  'published',
  1,
  '[
    {"heading": "Start with the network, not the brand", "body": "A phone that cannot hold 4G where you live is expensive decoration. MTN, Vodafone (Telecel), and AirtelTigo all run 4G, and 5G is rolling out in Accra, Kumasi, and Takoradi — but coverage outside the cities is still 4G-first. Check the exact LTE bands against your area before you compare prices.", "picks": [{"label": "5G-ready phones", "query": "5G", "limit": 4}]},
    {"heading": "Dual SIM is a feature, not a footnote", "body": "Most Ghanaian buyers run two lines — often MTN for mobile money plus a second network for data deals. A genuine dual-SIM tray (two nano SIMs, or SIM plus eSIM) saves carrying two handsets. Single-SIM imports look cheaper until you buy a second phone.", "picks": [{"label": "Latest phones", "categoryHandle": "phones", "limit": 4}]},
    {"heading": "Read the seller offer like a contract", "body": "Two listings can share a model name and differ on everything that matters: new versus locally used, warranty length, what is in the box, and the delivery promise. On alkemart every offer names its condition and terms — a missing warranty line means there is no warranty to claim.", "picks": [{"label": "Budget picks under comparison", "query": "Tecno", "limit": 4}]},
    {"heading": "Battery and charging realities", "body": "Dumsor-era habits die hard: a 5,000 mAh battery with 18W+ charging covers a full Accra day of hotspot use. Below that, budget for a power bank in the total cost. Sellers state condition honestly — a locally used phone at 80% battery health can still be the rational buy.", "picks": []}
  ]',
  '["phone-storage-ram-explained", "new-vs-locally-used-phones"]',
  now() + interval '180 days',
  now()
),
(
  'phone-storage-ram-explained',
  'Phone storage and RAM, explained for buyers',
  'What 128GB and 8GB actually buy you, and when to pay for more.',
  'Alkemart editorial',
  'published',
  1,
  '[
    {"heading": "Storage: 128GB is the floor", "body": "System software plus WhatsApp media eats 30–40GB in the first year. 128GB is the sensible minimum in 2026; pay for 256GB if you shoot video. Ignore the SD-card slot unless you actually move files to it — most buyers never do.", "picks": [{"label": "128GB and up", "query": "128GB", "limit": 4}]},
    {"heading": "RAM: 8GB for comfort, 4GB on a budget", "body": "RAM decides how many apps stay open without reloading — mobile money, maps, and music together want 8GB. On a tight budget 4–6GB works if you keep the app count low.", "picks": []}
  ]',
  '["buying-a-phone-in-ghana", "new-vs-locally-used-phones"]',
  now() + interval '180 days',
  now()
),
(
  'new-vs-locally-used-phones',
  'New versus locally used phones: the honest maths',
  'When a used phone wins, what to verify, and which promises must be written down.',
  'Alkemart editorial',
  'published',
  1,
  '[
    {"heading": "When used wins", "body": "A one-year-old flagship at 60% of its launch price usually beats a new budget phone on screen, camera, and build — provided the battery health, screen, and buttons check out. The discount must be real: compare against the current new price, not the launch price.", "picks": [{"label": "Compare new and used", "query": "Spark", "limit": 4}]},
    {"heading": "Get the promises in writing", "body": "Seller offers state condition, warranty, and returns terms. If the warranty line is empty, there is no warranty — negotiate it into the offer before paying, not after delivery. Cash on delivery lets you inspect first.", "picks": []}
  ]',
  '["buying-a-phone-in-ghana", "phone-storage-ram-explained"]',
  now() + interval '180 days',
  now()
)
ON CONFLICT (slug) DO NOTHING;
