import { logger } from "./logger";
import { DEFAULT_CURRENCY } from "./platform-config";
import { createHmac, timingSafeEqual } from "crypto";

export type MomoProvider = "mtn" | "vodafone" | "airteltigo";

// Paystack's Ghana mobile money charge API expects its own provider slugs,
// distinct from the buyer-facing names we show in the UI.
const PROVIDER_SLUGS: Record<MomoProvider, string> = {
  mtn: "mtn",
  vodafone: "vod",
  airteltigo: "atl",
};

export class PaymentDeclinedError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export interface MomoChargeResult {
  reference: string;
  provider: "paystack";
  /** Non-terminal status — order should be created as pending. */
  status: "success" | "pending";
}

/**
 * Charges a Ghanaian mobile money wallet through Paystack's Charge API
 * (https://api.paystack.co/charge) before the order is created. Paystack
 * mobile money charges can resolve synchronously in sandbox/test mode, or
 * require the buyer to approve a prompt/USSD on their phone in production.
 *
 * Returns `{ status: "success" }` for sync confirmations, or
 * `{ status: "pending" }` when the buyer must authorize on-device.
 * Throws `PaymentDeclinedError` only for hard declines.
 */
export async function chargeMobileMoney(params: {
  amountPesewas: number;
  email: string;
  phone: string;
  provider: MomoProvider;
  metadata?: Record<string, unknown>;
}): Promise<MomoChargeResult> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured");
  }

  let response: Response;
  try {
    response = await fetch("https://api.paystack.co/charge", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: params.amountPesewas,
        email: params.email,
        currency: DEFAULT_CURRENCY,
        mobile_money: {
          phone: params.phone,
          provider: PROVIDER_SLUGS[params.provider],
        },
        metadata: params.metadata ?? {},
      }),
    });
  } catch (error) {
    logger.error({ error }, "Paystack charge request failed");
    throw new PaymentDeclinedError("Could not reach the mobile money payment provider. Please try again.");
  }

  const body = (await response.json().catch(() => null)) as
    | { status: boolean; message?: string; data?: { status?: string; reference?: string; gateway_response?: string } }
    | null;

  if (!response.ok || !body?.status) {
    logger.warn({ status: response.status, body }, "Paystack charge rejected");
    throw new PaymentDeclinedError(body?.message ?? "Your mobile money payment could not be processed.");
  }

  if (!body.data?.reference) {
    throw new PaymentDeclinedError("Payment provider did not return a reference for this charge.");
  }

  const chargeStatus = body.data.status;

  if (chargeStatus === "success") {
    return { reference: body.data.reference, provider: "paystack", status: "success" };
  }

  if (chargeStatus === "pending" || chargeStatus === "send_otp" || chargeStatus === "pay_offline") {
    logger.info({ chargeStatus, reference: body.data.reference }, "Paystack charge pending — async confirmation required");
    return { reference: body.data.reference, provider: "paystack", status: "pending" };
  }

  // Terminal failure (declined, abandoned, etc.)
  logger.warn({ chargeStatus, body }, "Paystack charge did not complete");
  throw new PaymentDeclinedError(
    body.data?.gateway_response ??
      "Your mobile money payment was not approved. Please confirm the prompt on your phone and try again.",
  );
}

/**
 * Refunds a previously-successful Paystack charge (https://api.paystack.co/refund).
 * Used when a momo charge succeeds but the order can't be created afterward
 * (e.g. stock sold out to a concurrent checkout) — the buyer's money must not
 * be left captured with no order to show for it.
 *
 * This never throws: a failed refund attempt is a reconciliation problem, not
 * something the checkout request can recover from by retrying inline. Callers
 * should log the returned failure and flag the order/charge for manual review.
 */
export async function refundMomoCharge(params: {
  reference: string;
  amountPesewas: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return { ok: false, error: "PAYSTACK_SECRET_KEY is not configured" };
  }

  let response: Response;
  try {
    response = await fetch("https://api.paystack.co/refund", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transaction: params.reference,
        amount: params.amountPesewas,
      }),
    });
  } catch (error) {
    logger.error({ error, reference: params.reference }, "Paystack refund request failed");
    return { ok: false, error: "Could not reach the payment provider to issue a refund." };
  }

  const body = (await response.json().catch(() => null)) as { status: boolean; message?: string } | null;

  if (!response.ok || !body?.status) {
    logger.error({ status: response.status, body, reference: params.reference }, "Paystack refund rejected");
    return { ok: false, error: body?.message ?? "Refund request was rejected by the payment provider." };
  }

  return { ok: true };
}

/**
 * Verifies the Paystack webhook signature using HMAC-SHA512 with the
 * secret key. Paystack signs the raw request body; we recompute the
 * signature and compare with timing-safe equality.
 */
export function verifyPaystackWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey || !signatureHeader) return false;

  const computed = createHmac("sha512", secretKey).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(signatureHeader, "hex"));
  } catch {
    return false;
  }
}

/**
 * Verify a Paystack transaction by reference. Used by the webhook handler
 * and the recovery/refresh worker to confirm charge status.
 */
export async function verifyPaystackTransaction(
  reference: string,
): Promise<{ status: string; amount: number; currency: string; reference: string } | null> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return null;

  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    const body = (await response.json().catch(() => null)) as {
      status: boolean;
      data?: { status: string; amount: number; currency: string; reference: string };
    } | null;

    if (!response.ok || !body?.status || !body.data) {
      logger.warn({ reference, status: response.status }, "Paystack verify failed");
      return null;
    }
    return body.data;
  } catch (error) {
    logger.error({ error, reference }, "Paystack verify request failed");
    return null;
  }
}

/**
 * Paystack webhook event data shape (subset used by our handler).
 */
export interface PaystackWebhookEvent {
  event: string;
  data: {
    id: number;
    reference: string;
    amount: number;
    currency: string;
    status: string;
    metadata?: Record<string, unknown>;
    gateway_response?: string;
  };
}
