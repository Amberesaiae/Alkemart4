import type { AuthRepository } from "../auth-repository"

/** Read current ownership and verification, never a stale session claim. */
export async function hasVerifiedOwner(authRepo: AuthRepository, sellerId: string): Promise<boolean> {
  const members = await authRepo.listSellerMembers(sellerId)
  for (const member of members) {
    if (member.role !== "owner") continue
    const user = await authRepo.findUserById(member.userId)
    if (user?.role === "seller_member" && user.emailVerifiedAt) return true
  }
  return false
}
