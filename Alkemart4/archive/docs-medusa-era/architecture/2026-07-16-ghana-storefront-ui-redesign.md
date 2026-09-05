# Alkemart storefront UI redesign — Ghana market

| Field | Value |
|---|---|
| **Date** | 2026-07-16 |
| **Status** | In progress — Phases 0–4 core shipped on yellow palette |
| **Scope** | **Buyer SPA only** (`artifacts/alkemart`) |
| **Out of scope** | Mercur Admin (`:7000`) and Vendor Hub (`:7001`) — keep Mercur chrome; optional light theme later |
| **Backend** | Medusa + Mercur API; SPA is headless consumer |

---

## 1. Why redesign

Today’s SPA is still a **US big-box clone**:

- Walmart-style **yellow primary** + white chrome + dense utilitarian layout  
- Residual US lexicon (SNAP-style badges, “My Items”, Walmart-ish filters, generic “Express”)  
- Trust model of **pickup-from-superstore**, not **MoMo + multi-vendor Accra delivery**  
- Ops menus bolted into SPA while **Mercur already owns admin/vendor UI**

Ghana shoppers need different signals: **payment methods they trust**, **who is selling**, **delivery honesty**, **phone-first layout**, **GHS clarity**, local categories and language tone.

**Principle:** Alkemart SPA = **Ghana marketplace brand**. Mercur panels = **ops tools**. Do not redesign Mercur into Walmart either.

---

## 2. Product surfaces after realignment

| Surface | Product | UI owner |
|---------|---------|----------|
| Browse, PDP, cart, checkout, account, orders | Buyers | **Alkemart SPA** (redesign here) |
| Seller onboarding, catalog, fulfillments | Vendors | **Mercur Vendor Hub** |
| Platform ops, sellers, commissions, regions | Admins | **Mercur Admin** |
| SPA `/admin`, `/vendor` | Legacy dual-home | **Deprecate / deep-link out** to Mercur URLs |

---

## 3. Design north star — “Accra marketplace”

Not: US warehouse club.  
Not: pure luxury editorial.  

**Yes:** mobile-first, high-trust multi-vendor market — clear prices, MoMo-first pay, local delivery, sold-by vendors, warm but modern Ghana retail energy.

### Brand pillars

| Pillar | Meaning in UI |
|--------|----------------|
| **Trust** | Sold-by vendor, ratings, stock honesty, delivery promise, secure Paystack badges |
| **Local** | GHS, Accra/regions, GhanaPost GPS / landmark addresses, MoMo labels (MTN / Telecel / AT) |
| **Speed** | Search first, big tap targets, short checkout, reorder |
| **Market energy** | Color, category discovery, deals — without looking like a foreign chain |

### Visual direction — **keep existing Alkemart color scheme**

**Locked by product (2026-07-16):** do **not** rebrand to green or replace the yellow/white system.

| Token | Keep (current SPA) | Notes |
|-------|--------------------|--------|
| Primary action | `#f5c518` yellow | CTAs, search spark, primary buttons |
| Primary hover | `#e6b40f` | Existing |
| Primary foreground | `#1a1a1a` | Black on yellow |
| Header | White `#ffffff` + black type | Existing chrome |
| Canvas | White `#ffffff` | Existing |
| Accent / spark | Yellow family (`#ffe566` / `#f5c518`) | Deals, highlights |
| Price / ink | `#1a1a1a` | Clear **GH₵** formatting (behavior, not hue) |
| Muted | `#737373` | Secondary meta |
| Type | Inter Variable | Keep |
| Radius | Existing 2–8px scale | Optional slight soften later; not a rebrand |

**Redesign is layout, IA, copy, trust, Ghana fit — not a new palette.**

What changes *within* this scheme:

- Use yellow for **actions**, not every band/banner (reduce yellow fatigue without changing hex)
- Stronger **sold-by / MoMo / delivery** hierarchy in black/gray type
- Ghana copy and structure; same colors

---

## 4. Information architecture (buyer SPA)

### Keep (simplified)

```text
Home
  → Search / Departments
  → Category PLP / Browse
  → PDP (sold-by, MoMo, delivery)
  → Cart → Checkout (address + Paystack channels)
  → Orders / Account
  → Vendor storefront /store/$slug (read-only buyer view)
```

### Remove or de-emphasize from SPA

- In-SPA full **admin** and **vendor portal** (link out: “Seller portal” → Mercur `:7001`)
- US program badges, fake “eligible” payment chips  
- Dense dual chrome that copies US superstore  

### Header (Ghana)

| Zone | Content |
|------|---------|
| Left | Logo + **Deliver to** (city / landmark, not “Store #”) |
| Center | **Search** (primary — large, always visible on mobile sticky) |
| Right | Account · Orders · Cart (with count) |
| Below | Departments: Food · Beauty · Home · Phones · Fashion · … (local taxonomy) |
| Optional strip | “Pay with MoMo · Card · Bank” trust chips |

### Home modules (priority order)

1. **Search + location** already in chrome  
2. **Hero** — one Ghana-relevant promo (not US holidays)  
3. **Shop by category** — visual tiles  
4. **Deals near you / Today’s market** rail  
5. **Top vendors** (avatars + store names)  
6. **Fresh / Fast delivery** rail (if data exists)  
7. Footer: help, MoMo FAQ, seller CTA → Vendor Hub  

### Product card (must-have hierarchy)

1. Image  
2. **Price GH₵** (largest type after image)  
3. Title (2 lines)  
4. **Sold by {vendor}**  
5. Rating · stock honesty  
6. Delivery meta (e.g. “Accra · 1–2 days”)  
7. Add / Buy — green CTA  

### Checkout (Ghana)

1. Cart review (group by seller optional)  
2. **Address** — phone required, GhanaPost GPS / landmark, region  
3. **Pay** — MoMo first, then card, bank transfer (Paystack channels)  
4. Confirmation — order id, what to expect on phone for MoMo  

---

## 5. Component realignment map

| Current component | Action |
|-------------------|--------|
| `announcement-yellow` | Keep yellow scheme; tighten **copy** to Ghana promos, not US seasons |
| `snap-ebt-badge` / MoMo-relabeled US concept | **Delete**; replace with purpose-built MoMo badge (still yellow/black if needed) |
| `express-delivery-band` US copy | Keep chrome; Accra/local delivery **wording** |
| `product-card` | Add sold-by, GHS hierarchy, trust row (**same colors**) |
| `site-header` | Drop ops density; Ghana location + search first (**white/yellow chrome stays**) |
| `payment-method-selector` | MoMo providers + card; no SNAP logic |
| `address-form` | digitalAddress + landmark first-class |
| `homepage-sections` | Vendors, MoMo trust, local categories — **on existing palette** |
| Admin/vendor routes in SPA | Redirect / external link to Mercur panels |

---

## 6. Phased delivery (PR-sized)

### Phase 0 — Scope lock (½ day)

- [x] Freeze: SPA = buyer only (ops → Mercur URLs)
- [x] Links: “Sell on Alkemart” → `VITE_MERCUR_VENDOR_URL`
- [x] Default ops menus off; legacy SPA ops only when flags/env enable

### Phase 1 — Chrome + IA (keep colors) (1–2 days)

- [x] **Do not** change primary/header/canvas hex in `index.css`
- [x] Header: Ghana trust strip, Orders copy, Sell link
- [x] Footer: Ghana MoMo blurb + Sell external
- [x] Departments fallback: local categories; Sell in strip
- [x] Account menu: Sell hub + Admin hub external
- [x] Location chip: delivery-first Ghana wording
- [x] Search placeholder + price bands GHS-friendlier
- [ ] Logo polish if needed (optional)
- [ ] Spacing/hierarchy on cards/PLP (Phase 2)

### Phase 2 — Core commerce surfaces (3–5 days)

- [x] Product card hierarchy: price → title → sold-by → rating/stock → delivery → yellow Add
- [x] PLP: vendorName/stock, GHS copy, honest empty “sellers still listing”
- [x] PDP buy box: GHS price, MoMo/card chips, delivery note, sold-by up top
- [x] Rails + store page pass vendor/stock when available
- [x] Cart + checkout visual pass (Phase 2b)
- [x] Empty cart state, MoMo-first payment UI, line-item hierarchy
- [ ] Remaining route polish (orders account) as needed

### Phase 3 — Home & discovery (2–3 days)

- [x] Home modules: MoMo promo · Ghana hero · categories · market rails · trust grid · delivery honesty · seller CTA → Mercur  
- [x] Category row falls back to `SITE_DEPARTMENTS` when catalog empty  
- [x] Announcement / express / hero copy de-US’d (same yellow palette)  
- [ ] Local language labels optional later  
- [ ] Vendor store page polish (light)

### Phase 4 — Trust & polish (ongoing)

- [x] Paystack channel badges (`PaymentChannelBadges` on PDP, cart, checkout)  
- [x] Loading skeletons (PLP grid, rails, cart lines, PDP, checkout addresses)  
- [x] Mobile: header trust strip scroll, 44px primary CTAs (`Button` size lg)  
- [x] a11y contrast: muted `#5c5c5c`, success `#166534` on white; black on yellow CTAs  
- [ ] Deeper device-lab QA as catalog fills

**Do not** block redesign on full Mercur product seed — use honest empty states until catalog is real via vendor RBAC UI.

---

## 7. Explicit non-goals

- Restyling Mercur Admin/Vendor to match SPA 1:1  
- Rebuilding seller tools inside SPA  
- Pixel-copy Jumia/Tonaton (inspire, don’t clone)  
- Dark mode as v1 requirement  

---

## 8. Success criteria

| Metric | Pass |
|--------|------|
| First glance | Looks Ghana marketplace, not US club  
| Header | Search + location + cart clear in &lt;1s mental parse  
| Card | Price + sold-by visible without scrolling on mobile  
| Checkout | MoMo is the hero path in UI  
| Ops | No fake admin/vendor parity in SPA  
| Honesty | Empty catalog says “vendors coming” not stub products  

---

## 9. Recommended next step

1. **Approve this direction** (keep yellow/white/black palette; SPA buyer-only; Ghana IA/copy/trust).  
2. Optional: 1 mock home + product card **in current colors**.  
3. Implement **Phase 1 chrome + IA** on `feat/ghana-storefront-ui` (no palette swap).  

---

## 10. Relationship to architecture

| Doc | Role |
|-----|------|
| Clean-slate backend | API = Mercur/Medusa |
| This redesign | Buyer SPA visual + IA |
| Commercial spine | Money, MoMo, addresses (behavior) |
| Walmart UX spec (2026-07-13) | **Superseded** for brand; keep only generic hierarchy lessons (search first, price prominence) |

**One sentence:**  
**Keep Alkemart’s yellow/white/black scheme; redesign structure, trust, and Ghana market fit on the buyer SPA; leave seller/admin to Mercur.**
