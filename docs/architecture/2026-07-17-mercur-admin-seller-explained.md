# Mercur admin & seller — plain English guide

| Field | Value |
|-------|--------|
| **Date** | 2026-07-17 |
| **Audience** | You, running Alkemart locally |
| **API** | `http://localhost:9000` (confirmed healthy when writing this) |

## Why you cannot “sign up” as admin

There are **three different logins**. They do **not** share accounts.

| Who | Login panel | Auth type | Can self-register? |
|-----|-------------|-----------|--------------------|
| **Shopper** | Storefront `:5175/signin` | Customer | Yes |
| **Seller** | `:9000/seller` | Member | Yes (then create seller) |
| **Admin** | `:9000/dashboard` | User | **No** — must be created by CLI or invite |

Admin is platform staff. The dashboard **login** page only accepts existing users.  
`POST /auth/user/emailpass/register` may return a token with an **empty** `actor_id` — that is **not** a working admin. It will not open the dashboard properly.

## Your local admin credentials (already exist)

These were verified against your running API on 2026-07-17:

| Field | Value |
|-------|--------|
| **URL** | http://localhost:9000/dashboard |
| **Email** | `admin@alkemart.local` |
| **Password** | `supersecret` |
| **Role** | `role_super_admin` |

Use these on the **Admin** panel only — not on the buyer storefront and not on Seller hub.

If login fails later, recreate with CLI (from Linux backend worktree):

```bash
cd /home/amber/alkemart-backend/packages/api   # or apps/backend/packages/api
bunx medusa user -e admin@alkemart.local -p 'YourNewPasswordHere'
```

## Seller: no working demo login yet

Seed file *would* create:

- Email: `seller@mercur.dev`
- Password: `supersecret`

On this database those credentials currently return **Invalid email or password** — seed seller was never applied, or was wiped. **There is no secret seller password you are missing**; you create a seller yourself.

### How a seller is born (correct flow)

```
1. Go to http://localhost:9000/seller/register
   → creates a MEMBER (seller staff login)

2. Complete “create seller / store” in the vendor panel
   → seller often starts as pending_approval

3. Log into ADMIN (credentials above)
   → approve the seller

4. Back in SELLER hub
   → stock location, products, shipping, offers

5. Buyer storefront (:5175)
   → catalog shows published products from store API
```

**Important auth detail:** seller APIs use the **`member`** actor, not the shopper’s customer JWT and not the admin user.

## What each panel manages

### Admin — http://localhost:9000/dashboard

Think **marketplace operator**:

- Approve / reject sellers  
- Confirm product requests (if that flow is on)  
- Regions, currencies (e.g. Ghana / GHS), sales channels  
- Platform users, marketplace settings, commissions (Mercur modules)

### Seller hub — http://localhost:9000/seller

Think **one shop**:

- Your products and variants  
- Stock locations and inventory  
- Shipping options  
- Offers (what the storefront can add to cart)  
- Incoming orders and fulfillment  

### Buyer storefront — http://localhost:5175

Think **shoppers only**:

- Browse, cart, COD checkout  
- Customer account / addresses / orders  
- **Not** a place to manage sellers or admin  

Entry page that explains this: http://localhost:5175/partners  

## Mental model (one marketplace, three doors)

```
                    ┌─────────────────────┐
                    │   Medusa + Mercur   │
                    │   API :9000         │
                    └──────────┬──────────┘
           ┌───────────────────┼───────────────────┐
           ▼                   ▼                   ▼
   ┌───────────────┐  ┌────────────────┐  ┌────────────────┐
   │ Admin user    │  │ Member/seller  │  │ Customer       │
   │ /dashboard    │  │ /seller        │  │ storefront     │
   │ YOU (ops)     │  │ shop owner     │  │ shopper        │
   └───────────────┘  └────────────────┘  └────────────────┘
```

## Quick checklist for today

1. **API up:** `curl http://localhost:9000/health` → `OK`  
2. **Admin login:** dashboard + `admin@alkemart.local` / `supersecret`  
3. **Seller:** register at `/seller/register` (do not expect a pre-made password)  
4. **Approve seller** in Admin  
5. **Publish catalog** in Seller hub so `:5175` has products  
6. **Buyer** uses only the storefront for shopping  

## Related docs

- Runbook (API curl detail): `2026-07-16-mercur-vendor-rbac-catalog-runbook.md`  
- Surface plan: `2026-07-16-ops-rbac-surfaces.md`  
- Storefront access: `apps/storefront/docs/ACCESS-AND-RBAC.md`  
