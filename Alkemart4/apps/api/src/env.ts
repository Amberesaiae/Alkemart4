import { z } from "zod"

const EnvSchema = z.object({
  ENVIRONMENT: z.enum(["development", "staging", "production"]).default("development"),
})

export type ApiEnv = z.infer<typeof EnvSchema> & {
  HYPERDRIVE: { connectionString: string }
  HYPERDRIVE_PRIMARY: { connectionString: string }
  CATALOG_KV: KVNamespace
}

export function parseEnv(env: Record<string, unknown>): ApiEnv {
  const base = EnvSchema.parse(env)
  if (!env.HYPERDRIVE || !env.HYPERDRIVE_PRIMARY || !env.CATALOG_KV) {
    throw new Error("Missing Hyperdrive or CATALOG_KV bindings")
  }
  return {
    ...base,
    HYPERDRIVE: env.HYPERDRIVE as ApiEnv["HYPERDRIVE"],
    HYPERDRIVE_PRIMARY: env.HYPERDRIVE_PRIMARY as ApiEnv["HYPERDRIVE_PRIMARY"],
    CATALOG_KV: env.CATALOG_KV as KVNamespace,
  }
}
