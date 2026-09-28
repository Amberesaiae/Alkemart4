/** Test fixture only; production callers must prove email ownership. */
import type { AuthRepository } from "../auth-repository"
import { signSessionJwt } from "./jwt"

export async function verifiedBuyerFixture(repo: AuthRepository, secret: string, email = "buyer@alkemart.test") {
  let user = await repo.findUserByEmail(email)
  if (!user) user = await repo.createUser({ id: crypto.randomUUID(), email, passwordHash: "!test-only", role: "buyer" })
  user = await repo.markEmailVerified(user.id)
  return signSessionJwt({ userId: user.id, role: "buyer", pwd: user.passwordChangedAt?.getTime() ?? 0 }, secret)
}
