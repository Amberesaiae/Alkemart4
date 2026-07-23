import { logger } from "./logger";
import { EMAIL_FROM } from "./platform-config";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_BASE_URL = "https://api.resend.com";

/**
 * Sends a transactional email through the Resend API directly.
 * Requires RESEND_API_KEY env var.
 */
export async function sendEmail(params: { to: string; subject: string; html: string }): Promise<void> {
  if (!RESEND_API_KEY) {
    logger.warn("RESEND_API_KEY not set — email not sent");
    return;
  }

  const response = await fetch(`${RESEND_BASE_URL}/emails`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    logger.error({ status: response.status, body }, "Resend email send failed");
    throw new Error(`Resend email send failed with status ${response.status}`);
  }
}
