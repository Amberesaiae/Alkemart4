import { hashPassword, type PasswordHashIterations } from "@alkemart/domain"
import type { Context } from "hono"
import type { AppEnv } from "../context"

export function passwordWorkFactor(c: Context<AppEnv>): PasswordHashIterations {
  const value = c.env?.PASSWORD_HASH_ITERATIONS
  if (value !== undefined && value !== "100000" && value !== "600000") throw new Error("Invalid password work factor")
  return value === "600000" ? 600_000 : 100_000
}

export function hashPasswordForRequest(c: Context<AppEnv>, password: string) {
  return hashPassword(password, passwordWorkFactor(c))
}
