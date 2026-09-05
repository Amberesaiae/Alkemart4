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

## Seller: lab login (ready)

| Field | Value |
|-------|--------|
| **URL** | http://localhost:7001/seller (or http://localhost:9000/seller) |
| **Email** | `seller@alkemart.local` |
| **Password** | `supersecret` |
| **Store** | Alkemart Lab Shop (status `open`) |

Repair if broken:

```bash
cd packages/api
bunx medusa exec ./src/scripts/ensure-lab-seller.ts
```

Seed also uses `seller@alkemart.local` (not `seller@mercur.dev`).

### How a seller is born (correct flow)

```
1. Register / auth as member (panel login or /seller/register)

2. Create seller/store (onboarding) OR run ensure-lab-seller.ts

3. Admin approves if status is pending_approval
   (ensure-lab-seller auto-approves)

4. Store-select → open the store → catalog, shipping, offers

5. Buyer storefront (:5175)
   → catalog shows published products from store API
```

**Important auth detail:** seller APIs use the **`member`** actor + `x-seller-id` after store select — not the shopper JWT and not the admin user.

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
