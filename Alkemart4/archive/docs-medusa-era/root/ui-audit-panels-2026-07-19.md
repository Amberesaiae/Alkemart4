# Admin + Seller Hub UI consistency (2026-07-19)

## Problem

Mercur Admin and Seller Hub were themed with similar yellow tokens but **diverged** in:

| Area | Inconsistency |
|------|----------------|
| Login wordmark | Admin centered / larger vs Seller left-aligned |
| Buttons | Admin had `.alk-btn`; Seller setup form used raw `ui-button` / unstyled inputs |
| Forms | Inline styles on ops queues vs no form kit on seller |
| Cards | KPI boxes reused as queue cards vs ad-hoc seller panels |
| Shared components | Duplicate `ui.tsx` with only a comment difference |

## Standard (both panels)

**Tokens:** `--alkemart-yellow` `#f5c518`, black/white/cream, radius 12 / 8  
**Wordmark:** `alkemart.` + role line (Seller Hub | Admin), left-aligned, 1.5rem  
**Primary button:** yellow fill, black text (`.alk-btn`)  
**Secondary:** white + border (`.alk-btn-secondary`)  
**Surfaces:** `.alk-panel`, `.alk-banner`, `.alk-page` / KPIs / charts  
**Forms:** `.alk-field`, `.alk-input`, `.alk-select`, `.alk-form-grid`  
**Lists:** `.alk-checklist`, `.alk-stack`  

Source of truth for primitives: identical trailing block  
*Shared panel primitives — Admin + Seller Hub*  
in:

- `apps/vendor/src/styles/alkemart-brand.css`
- `apps/admin/src/styles/alkemart-brand.css`

Shared React primitives in both `components/ui.tsx`:

`AlkPage`, `AlkPageHeader`, `AlkBanner`, `AlkPanel`, `AlkField`, `AlkButton`, `AlkKpi*`, `AlkEmpty`, `AlkError`

## Changes landed

1. Shared CSS primitives appended to **both** brand files  
2. `AlkPanel` / `AlkField` / `AlkButton` added to both `ui.tsx`  
3. Seller Ghana quick setup uses only alk-* classes  
4. Admin Seller queue + Product review: panels, form kit, no inline style soup  
5. Login brand data attrs aligned  

## Still different (by design)

| Panel | Extra |
|-------|--------|
| Seller Hub | Auth art panel, seller-only onboarding/quality widgets |
| Admin | Language select, ops queues, markets, moderation routes |

## Follow-ups

- Extract shared CSS to one package import if monorepo tooling allows (avoid dual-file drift)  
- Apply same form kit to any remaining inline-style routes  
- Headed screenshot pass of login + home + queue on both ports  
