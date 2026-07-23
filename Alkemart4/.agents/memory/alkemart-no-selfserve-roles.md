---
name: Alkemart no self-serve vendor/admin roles
description: How to get a test user into vendor_owner or admin role in the Alkemart marketplace app for manual/e2e testing.
---

Alkemart's signup flow only ever creates users with the `buyer` role. There is no API endpoint that grants `vendor_owner`, `vendor_staff`, `admin`, or `support_agent`, and there are no vendor rows created by any user-facing flow either.

**Why:** By product design, vendor onboarding and admin provisioning are meant to happen out-of-band (real-world equivalent: a business application/approval process), not via self-serve signup.

**How to apply:** To test vendor or admin flows end-to-end, insert directly into the dev DB after signing the user up normally via `/auth/signup`:
```sql
INSERT INTO vendors (slug, name) VALUES ('vendor-one', 'Vendor One Shop') RETURNING id;
INSERT INTO user_roles (user_id, role, vendor_id) VALUES (<user_id>, 'vendor_owner', <vendor_id>);
-- or for admin:
INSERT INTO user_roles (user_id, role, vendor_id) VALUES (<user_id>, 'admin', NULL);
```
Also note: a fresh dev DB has no categories, so creating a product via `/vendor/products` will fail until at least one row exists in `categories`.
