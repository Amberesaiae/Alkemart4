import { defineWidgetConfig } from "@mercurjs/dashboard-sdk"

export const config = defineWidgetConfig({
  zone: "login.logo.after",
})

/**
 * Login wordmark — Seller Hub.
 * Note: Mercur 2.2 login page does not mount WidgetZone; brand-patch.ts
 * injects the same lockup. Kept for when zones are wired.
 */
export default function LoginBrand() {
  return (
    <div className="alk-login-brand" data-login-logo="1">
      <div className="alk-login-wordmark">
        alkemart<span className="alk-dot">.</span>
      </div>
      <div className="alk-login-role">Seller Hub</div>
    </div>
  )
}
