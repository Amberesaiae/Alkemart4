# Storefront vs Mowafer — journey audit (2026-07-19)

Screenshots: this folder (`01-home` … `09-product`).  
References: `ui/E-Commerce Platform _ Mowafer __ Behance/` (web boards imgi_10–13).

---

## Critical fix applied mid-audit

| Issue | Evidence | Fix |
|-------|----------|-----|
| **Blank white app** | First screenshot set all-white; `BrandLogo` export empty via Vite cache | Rewrote `BrandLogo` + cleared Vite cache + restart |
| **PDP “empty” skeleton** | Early shot before API settle | Real PDP loads after handle lookup (404 id → list by handle) |

---

## Journey matrix

| # | Journey | Mowafer board | Screenshot | Match | Gaps vs Mowafer |
|---|---------|---------------|------------|-------|-----------------|
| 1 | **Home** | imgi_10 homepage | `01-home-*` | **Strong** | Mosaic uses icon watermarks not photography; rail uses pixel icons not line icons; no top text-nav (intentional: alkemart text logo only) |
| 2 | **PLP / browse** | imgi_11 category listing | `02-browse-all-*`, `03-browse-electronics-*` | **Good** | Colored category panel present; missing large PLP hero photo; filters simpler than Mowafer rating/price sliders |
| 3 | **PDP** | (app board multi-seller) | `09-product-*` | **Good (after wait)** | Multi-seller “Other sellers & prices” present; layout 3-col on desktop; less gallery density than Mowafer |
| 4 | **Cart** | imgi_13 top | `04-cart-*` | **OK empty** | Empty state clean; filled cart not audited this pass (no session lines) |
| 5 | **Checkout** | imgi_13 steps | `05-checkout-*` | **OK empty** | Empty-cart gate; stepped COD flow exists in code when cart has lines |
| 6 | **Help** | — | `06-help-*` | N/A | Utility page |
| 7 | **Sign in** | — | `07-signin-*` | **Good** | Split panel + **alkemart.** wordmark; language switcher removed |
| 8 | **Search** | — | `08-search-*` | OK | Facets present |

---

## Section-by-section (Home vs imgi_10)

| Band | Mowafer | Alkemart now | Verdict |
|------|---------|--------------|---------|
| Header | Logo mark + search + Home/Last Offers/Contact | **Text logo `alkemart.`** + search + account + cart | Intentional (user: text logo only; no Home/Help/English) |
| Category rail | 6 line icons | Up to **6** departments + All (pixel iconpack) | Structure match; icon style differs (asset set) |
| Mosaic | 4 photo tiles Pets/Food/Cosmetics/Electronics | Same 4-tile asymmetric grid + colors | **Match** structure |
| Last Offers | Tabs + mixed product grid | Tabs + sort + uniform compact cards | **Match** hierarchy; denser grid than art board |
| How it works | (not on imgi_10) | 4-step IconScout band | Extra band (requested) |
| Delivery | Copy + illustration | Compact strip + scooter art | **Match** intent |
| Advertise | Yellow form | Compact yellow form | **Match** |
| Footer | Brand + columns | **alkemart.** + Shop/Account/Partners | **Match** |

---

## Fixes shipped from this audit

1. Restored app after blank-page (`BrandLogo` Vite empty module).  
2. Category rail capped at **6** depts (Mowafer density).  
3. Rail labels use **text-sm** (no xs).  
4. Category rail **hidden** on cart / checkout / PDP (focus commerce).  
5. Sign-in **language control removed**.  
6. Listing breadcrumb/type floor **sm+**.

---

## Remaining backlog (not blocking home)

| Priority | Item | Mowafer cue |
|----------|------|-------------|
| P1 | PLP category hero banner + photo tiles when images exist | imgi_11 top hero |
| P1 | Filled-cart + multi-step checkout visual pass with real lines | imgi_13 |
| P2 | Line-style category icons (replace pixel pack for rail only) | imgi_10 rail |
| P2 | Mosaic photography backgrounds (`public/images/categories/`) | imgi_10 tiles |
| P3 | Hide demo lab banner for non-lab users | cleanliness |

---

## How to re-audit

```bash
# Vite on :5175, then:
CHROME=~/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome \
  bun /tmp/shot.mjs
# outputs → docs/ui-audit-storefront-2026-07-19/
```
