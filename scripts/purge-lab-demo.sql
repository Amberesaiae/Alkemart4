-- Production purge: lab/demo accounts + lab products.
-- KEEP admins: isaiahamber5@gmail.com, akpey.mawuena@gmail.com
-- Soft-delete only (deleted_at). Run via neonctl psql.

BEGIN;

-- 1) Soft-delete lab admin user (keep real admins)
UPDATE "user"
SET deleted_at = NOW()
WHERE deleted_at IS NULL
  AND email ILIKE '%@alkemart.local';

-- 2) Soft-delete lab/e2e customers
UPDATE customer
SET deleted_at = NOW()
WHERE deleted_at IS NULL
  AND (
    email ILIKE '%@alkemart.local'
    OR email ILIKE '%@lab.alkemart.local'
    OR email ILIKE 'e2e-%@example.com'
    OR email ILIKE '%e2e%@%'
    OR email IN ('t@example.com', 'cod.lab@example.com')
  );

-- 3) Soft-delete lab sellers (not real Gmail vendor stores)
UPDATE seller
SET deleted_at = NOW(), status = 'closed'
WHERE deleted_at IS NULL
  AND (
    email ILIKE '%@alkemart.local'
    OR handle IN ('alkemart-lab-shop', 'accra-market', 'tema-fresh')
    OR name ILIKE '%Lab Shop%'
  );

-- 4) Soft-delete lab/e2e products
UPDATE product
SET deleted_at = NOW(), status = 'rejected'
WHERE deleted_at IS NULL
  AND (
    handle ILIKE 'lab-%'
    OR handle ILIKE 'e2e-%'
    OR title ILIKE '%(Lab)%'
    OR title ILIKE '%Live E2E%'
    OR title ILIKE '%Ghana Doorstep Bundle%'
  );

-- 5) Soft-delete offers for deleted sellers/products
UPDATE offer o
SET deleted_at = NOW()
WHERE o.deleted_at IS NULL
  AND (
    o.seller_id IN (SELECT id FROM seller WHERE deleted_at IS NOT NULL)
    OR o.product_id IN (SELECT id FROM product WHERE deleted_at IS NOT NULL)
  );

COMMIT;

-- Verification (read-only)
SELECT 'users_remaining' AS k, email FROM "user" WHERE deleted_at IS NULL
UNION ALL
SELECT 'sellers_remaining', coalesce(email,'') || ' / ' || coalesce(handle,'') FROM seller WHERE deleted_at IS NULL
UNION ALL
SELECT 'lab_customers_left', email FROM customer WHERE deleted_at IS NULL AND email ILIKE '%alkemart.local%'
UNION ALL
SELECT 'lab_products_left', title FROM product WHERE deleted_at IS NULL AND (title ILIKE '%Lab%' OR handle ILIKE 'e2e-%' OR handle ILIKE 'lab-%');
