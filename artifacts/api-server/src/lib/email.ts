import { ReplitConnectors } from "@replit/connectors-sdk";
import { logger } from "./logger";

// Resend's shared sandbox sender — works without a verified custom domain,
// which this project does not have configured. Swap for a verified
// `orders@<yourdomain>` once the store's domain is verified with Resend.
const FROM_ADDRESS = "Alkemart <onboarding@resend.dev>";

/**
 * Fresh client per call — the connectors SDK issues short-lived tokens, so
 * this must never be module-level cached (see integrations skill).
 */
function getConnectors(): ReplitConnectors {
  return new ReplitConnectors();
}

/**
 * Sends a transactional email through the Resend connector. Failures are
 * caught and logged by the caller (domain event subscribers must never let
 * a notification-provider failure propagate back into checkout/order code),
 * so this simply throws on a non-2xx response for the caller to catch.
 */
export async function sendEmail(params: { to: string; subject: string; html: string }): Promise<void> {
  const connectors = getConnectors();
  const response = await connectors.proxy("resend", "/emails", {
    method: "POST",
    body: {
      from: FROM_ADDRESS,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    logger.error({ status: response.status, body }, "Resend email send failed");
    throw new Error(`Resend email send failed with status ${response.status}`);
  }
}
