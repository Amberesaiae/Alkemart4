import { logger } from "./logger";

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
}

/**
 * Charges a Ghanaian mobile money wallet through Paystack's Charge API
 * (https://api.paystack.co/charge) before the order is created. Paystack
 * mobile money charges can resolve synchronously in sandbox/test mode, or
 * require the buyer to approve a prompt/USSD on their phone in production —
 * either way, checkout must not confirm an order until Paystack reports the
 * charge as `success`. Any other outcome (declined, abandoned, pending
 * authorization) throws `PaymentDeclinedError` so the caller can surface a
 * clear error and skip order creation entirely.
 */
export async function chargeMobileMoney(params: {
  amountPesewas: number;
  email: string;
  phone: string;
  provider: MomoProvider;
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
        currency: "GHS",
        mobile_money: {
          phone: params.phone,
          provider: PROVIDER_SLUGS[params.provider],
        },
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

  const chargeStatus = body.data?.status;
  if (chargeStatus !== "success") {
    logger.warn({ chargeStatus, body }, "Paystack charge did not complete");
    throw new PaymentDeclinedError(
      body.data?.gateway_response ??
        "Your mobile money payment was not approved. Please confirm the prompt on your phone and try again.",
    );
  }

  if (!body.data?.reference) {
    throw new PaymentDeclinedError("Payment provider did not return a reference for this charge.");
  }

  return { reference: body.data.reference, provider: "paystack" };
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
