# Shop covers — brief for Codex

Every live shop needs a cover image. The storefront already renders
`sellers.banner` as the cover on the shop page, shop cards and the homepage
spotlight (`object-cover`, cropped wider on small screens). You only create the
image files; Claude uploads them and attaches each one to its shop. **Do not
edit code.** Write any concerns to `docs/CODEX-NOTES.md`.

Follow the brand system and style rules in `docs/CODEX-ASSETS.md` (bright
premium studio look, soft shadows, Africa-first but not country-specific, **no
text, no real brand logos, no watermarks, no faces**).

## Format

- **1600×500 px** (16:5), WebP, quality ≈ 82, under 250 KB each.
- Keep the subject inside the **centre 1000×400** safe area. Cards crop to
  about 3:1 and phones crop the sides; the shop's logo circle overlaps the
  bottom-left corner, so keep that corner quiet.
- A calm background that white text *could* sit on, but put no text in the image.
- Save to `apps/storefront-v2/public/images/shops/<handle>-cover.webp`.

## Shops

| File (`<handle>-cover.webp`) | Shop | What it sells → scene |
|---|---|---|
| `hurry-ventures` | Hurry Ventures | Leather jackets and sandals → a styled flat-lay of a leather jacket and sandals on a warm tan ground |
| `seller-b` | Kumasi Tech | Smartphones → a couple of unbranded modern phones on a deep blue ground |
| `demo-osu-electronics` | Osu Electronics | Electronics → unbranded headphones, phone and speaker on the electronics ground `#121216` |
| `demo-kumasi-fabrics` | Kumasi Fabrics | Fabrics and fashion → folded bolts of bold patterned wax-print fabric on the fashion ground `#7C4DFF` |
| `demo-takoradi-home` | Takoradi Home | Home goods → a tidy arrangement of cookware, woven baskets and a plant on the home ground `#F7B04A` |
| `demo-tamale-grocers` | Tamale Grocers | Groceries → a fresh produce and pantry spread (yams, peppers, rice, oil) on the food ground `#1B7F45` |

Accra Mart (suspended), Audit Vendor and QA Test Shop (terminated) are not
shown to buyers and need no cover.

When done, list the six files in `docs/CODEX-NOTES.md`; Claude will verify the
sizes and attach them.
