-- Structured product attributes — the "product stats" line on a card or
-- quick-buy dialog: { "label": "Volume", "value": "1ltr" }.
--
-- Distinct from variants: a variant is what a buyer chooses, an attribute is
-- what the item is. Nullable with no default, so existing products carry no
-- attributes rather than an empty array that reads as "we checked, there are
-- none".
ALTER TABLE products ADD COLUMN IF NOT EXISTS attributes jsonb;
