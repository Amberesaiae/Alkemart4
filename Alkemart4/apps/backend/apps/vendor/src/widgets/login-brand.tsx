import { defineWidgetConfig } from "@mercurjs/dashboard-sdk"

export const config = defineWidgetConfig({
  zone: "login.logo.after",
})

/**
 * Login wordmark — Seller Hub.
 * HTML text (not SVG) so it matches admin + storefront "alkemart." brand.
 * brand-patch.ts enforces the same when WidgetZone is not mounted.
 */
export default function LoginBrand() {
  return (
    <div className="alk-login-brand" data-login-logo="1" data-alk-login-wordmark="1">
      <div className="alk-login-wordmark">
        alkemart<span className="alk-dot">.</span>
      </div>
      <div className="alk-login-role">Seller Hub</div>
    </div>
  )
}
