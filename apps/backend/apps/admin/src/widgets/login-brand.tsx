import { defineWidgetConfig } from "@mercurjs/dashboard-sdk"

export const config = defineWidgetConfig({
  zone: "login.logo.after",
})

/** Login wordmark — Admin. */
export default function LoginBrand() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        marginBottom: 12,
        width: "100%",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: "#141414",
          display: "grid",
          placeItems: "center",
          color: "#f5c518",
          fontWeight: 800,
          fontSize: 22,
          letterSpacing: "-0.04em",
        }}
        aria-hidden
      >
        a
      </div>
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
          fontSize: 12,
          fontWeight: 700,
          color: "#5a5a5a",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        Admin
      </div>
    </div>
  )
}
