import { defineWidgetConfig } from "@mercurjs/dashboard-sdk"

export const config = defineWidgetConfig({
  zone: "login.after.after",
})

export default function LoginFooter() {
  return (
    <p
      style={{
        marginTop: 16,
        textAlign: "center",
        fontSize: 12,
        color: "#5c5c5c",
        lineHeight: 1.45,
      }}
    >
      Platform operations for <strong style={{ color: "#141414" }}>alkemart</strong>
      .
      <br />
      Sellers use Seller Hub · shoppers use the storefront.
    </p>
  )
}
