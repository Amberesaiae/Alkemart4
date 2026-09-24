import { z } from "zod"

const EnvSchema = z.object({
  ENVIRONMENT: z.enum(["development", "staging", "production"]).default("development"),
  JWT_SECRET: z.string().min(1),
  PAYSTACK_SECRET_KEY: z.string().min(1).optional(),
  /** Africa's Talking SMS (fulfillment notifications). Absent → log-only stub. */
  AT_USERNAME: z.string().min(1).optional(),
  AT_API_KEY: z.string().min(1).optional(),
  AT_SENDER_ID: z.string().min(1).optional(),
})

export type ApiEnv = z.infer<typeof EnvSchema> & {
  HYPERDRIVE: { connectionString: string }
  HYPERDRIVE_PRIMARY: { connectionString: string }
  CATALOG_KV: KVNamespace
  /** R2 media bucket. Optional so unit tests and KV-only flows keep working;
   * upload/media routes answer 501 when it is absent. */
  MEDIA_BUCKET?: R2Bucket
  /** Cloudflare Images binding for the upload conversion pipeline.
   * Optional: when absent (local dev, tests) uploads store the original only. */
  IMAGES?: ImagesBindingLike
  /** Workers AI. Optional: attribute suggestion answers 501 without it. */
  AI?: WorkersAiLike
}

/** Structural subset of the Workers AI binding used by attribute suggestion. */
export type WorkersAiLike = {
  run: (
    model: string,
    input: Record<string, unknown>,
  ) => Promise<{ response?: string } | string>
}

/** Structural subset of the Cloudflare Images binding used by the media pipeline. */
export type ImagesBindingLike = {
  input: (
    image: ArrayBuffer | Uint8Array | ReadableStream,
  ) => {
    transform: (opts: {
      width?: number
      height?: number
      fit?: "scale-down" | "contain" | "cover" | "crop" | "pad"
    }) => {
      output: (opts: { format: "image/webp" | "image/avif" | "image/jpeg"; quality?: number }) => {
        response: () => Promise<Response>
      }
    }
  }
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
