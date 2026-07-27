/**
 * Design system spine — import from here, not deep ad-hoc paths.
 *
 * Layer model:
 *   brand  → who we are (name, mark, wordmark)
 *   tokens → color, space, radius, layout, category accents
 *   icons  → IconSafe + category icon map
 *   shell  → AppHeader / CategoryIconRail / AppFooter / Container
 *   home   → mosaic, last offers, delivery, advertise
 *   commerce → ProductCard, listing, cart, checkout atoms
 */

export { brand } from "./brand"
export { Icon, IconSafe, IconFallback, ICON_IDS, categoryIconId } from "./icons"
export type { IconId } from "./icons"
