import { eq, sql } from "drizzle-orm";
import { db, promotionsTable, promotionRedemptionsTable } from "@workspace/db";
import type { Promotion } from "@workspace/db";

export class InvalidPromotionError extends Error {}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

/**
 * Validates a promo code against the subtotal and current rules (active,
 * date window, minimum order amount, usage limit), and returns the pesewas
 * amount to discount off the order. Throws `InvalidPromotionError` with a
 * user-facing message on any failed rule, rather than returning a
 * discriminated result — checkout only needs a discount-or-throw here.
 *
 * Must be called from within the checkout transaction (`tx`) so the usage
 * count check and the eventual redemption insert see a consistent snapshot
 * under concurrent checkouts.
 */
export async function validateAndComputePromotionDiscount(
  tx: Tx,
  code: string,
  subtotalPesewas: number,
): Promise<{ promotion: Promotion; discountPesewas: number }> {
  const [promotion] = await tx.select().from(promotionsTable).where(eq(promotionsTable.code, code));
  if (!promotion) {
    throw new InvalidPromotionError(`No promotion found for code "${code}"`);
  }
  if (!promotion.isActive) {
    throw new InvalidPromotionError(`Promotion code "${code}" is no longer active`);
  }
  const now = new Date();
  if (promotion.startsAt && now < promotion.startsAt) {
    throw new InvalidPromotionError(`Promotion code "${code}" is not active yet`);
  }
  if (promotion.endsAt && now > promotion.endsAt) {
    throw new InvalidPromotionError(`Promotion code "${code}" has expired`);
  }
  if (promotion.minOrderPesewas != null && subtotalPesewas < promotion.minOrderPesewas) {
    throw new InvalidPromotionError(
      `This order doesn't meet the GH₵${(promotion.minOrderPesewas / 100).toFixed(2)} minimum for code "${code}"`,
    );
  }
  if (promotion.usageLimit != null) {
    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(promotionRedemptionsTable)
      .where(eq(promotionRedemptionsTable.promotionId, promotion.id));
    if (count >= promotion.usageLimit) {
      throw new InvalidPromotionError(`Promotion code "${code}" has reached its usage limit`);
    }
  }

  const rawDiscount =
    promotion.discountType === "percentage"
      ? Math.round((subtotalPesewas * promotion.value) / 100)
      : promotion.value;
  const discountPesewas = Math.max(0, Math.min(rawDiscount, subtotalPesewas));

  return { promotion, discountPesewas };
}
