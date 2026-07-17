/// <reference types="@mercurjs/admin/extension-targets" />

/**
 * Host-declared login zones used by alkemart brand widgets.
 * Admin package's generated targets omit login.*; we augment safely.
 */
declare module "@mercurjs/dashboard-sdk" {
  interface WidgetZoneRegistry {
    "login.logo.after": true
    "login.logo.before": true
    "login.after.after": true
    "login.after.before": true
    "login.before.after": true
    "login.before.before": true
  }
}
