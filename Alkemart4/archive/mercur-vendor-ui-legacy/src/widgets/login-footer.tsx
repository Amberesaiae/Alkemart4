import { defineWidgetConfig } from "@mercurjs/dashboard-sdk"

export const config = defineWidgetConfig({
  zone: "login.after.after",
})

/**
 * Secondary actions under the sign-in form.
 * Keep it short — no brand slogans or role lectures (those live in title/hint).
 */
export default function LoginFooter() {
  // Relative to vendor base (/seller) — works on :9000/seller and :7001/seller
  const href = "register"

  return (
    <div className="alk-auth-footer" data-alk-auth-footer="1">
      <p className="alk-auth-footer-inline">
        New seller?{" "}
        <a className="alk-auth-footer-link" href={href}>
          Create an account
        </a>
      </p>
    </div>
  )
}
