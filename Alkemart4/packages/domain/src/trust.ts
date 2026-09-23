/**
 * Decomposed seller verification (blueprint Doc 04/09).
 * Every badge names exactly what was checked — "Verified" never implies
 * product authenticity, delivery performance, or brand authorization
 * unless that evidence exists.
 */

export type VerificationKind =
  | "contact"
  | "identity"
  | "business"
  | "brand_auth"
  | "fulfillment_proven"

export type VerificationStatus = "pending" | "verified" | "revoked" | "expired"

/** Buyer-facing meaning line per verification kind. */
export function verificationMeaning(kind: VerificationKind): string {
  switch (kind) {
    case "contact":
      return "Contact verified — the shop confirmed its phone and email."
    case "identity":
      return "Identity verified — the seller's identity document was checked."
    case "business":
      return "Business verified — registration details were checked."
    case "brand_auth":
      return "Authorized seller — the brand confirmed this shop may sell its goods."
    case "fulfillment_proven":
      return "Fulfillment proven — completed orders back this shop's record."
  }
}

/** Live (unexpired, unrevoked) verification as of `now`. */
export function isVerificationLive(
  status: VerificationStatus,
  expiresAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (status !== "verified") return false
  if (expiresAt && expiresAt.getTime() <= now.getTime()) return false
  return true
}
