import { defineWidgetConfig } from "@mercurjs/dashboard-sdk"

/**
 * Login logo zone — alkemart wordmark (replaces third-party branding visually).
 */
export const config = defineWidgetConfig({
  zone: "login.logo.after",
})

export default function LoginBrand() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        marginBottom: 8,
        width: "100%",
      }}
    >
      <div
        style={{
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          fontWeight: 800,
          fontSize: 28,
          letterSpacing: "-0.03em",
          color: "#141414",
          lineHeight: 1,
        }}
      >
        alkemart
        <span style={{ color: "#f5c518" }}>.</span>
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "#5a5a5a",
          letterSpacing: "0.02em",
        }}
      >
        Seller Hub
      </div>
    </div>
  )
}
