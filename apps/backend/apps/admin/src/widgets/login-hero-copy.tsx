import { defineWidgetConfig } from "@mercurjs/dashboard-sdk"

/**
 * Injected near login form — reinforces alkemart identity under default title.
 * CSS also rewrites “Welcome to Mercur” headings.
 */
export const config = defineWidgetConfig({
  zone: "login.before.after",
})

export default function LoginHeroCopy() {
  return (
    <div
      style={{
        textAlign: "center",
        marginBottom: 4,
        fontSize: 12,
        fontWeight: 600,
        color: "#5c5c5c",
      }}
      data-alk-login-hero
    >
      Platform control center
    </div>
  )
}
