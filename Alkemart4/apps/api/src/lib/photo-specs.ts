import type { AttributeDefinitionDto } from "../catalog-repository"
import type { WorkersAiLike } from "../env"
import { suggestAttributes, type AttributeSuggestion } from "./attribute-suggest"

/**
 * Read specs off a photo — a label, the box, a settings screen — into draft
 * attribute values the seller confirms before anything is saved (phase 6).
 *
 * Two steps, both untrusted: a vision model transcribes what's printed as
 * "Label: Value" lines; then the existing suggester maps those lines onto the
 * catalogue's attribute definitions and validates every value. Nothing here
 * writes.
 */
export const VISION_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct"

const PROMPT = [
  "Read the product details printed in this photo (a label, the box, or a settings/about screen).",
  "Reply with one detail per line as `Label: Value`, e.g. `Brand: Tecno`, `Storage: 128GB`.",
  "Only copy what is printed. Never guess or add anything that isn't visible.",
].join("\n")

/** Keep short "Label: Value" lines only; drop anything else the model says. */
export function cleanSpecLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s*•-]+/, "").trim())
    .filter((l) => /^[^:]{1,40}:\s*\S/.test(l) && l.length <= 120)
    .slice(0, 30)
}

export async function readPhotoSpecs(
  ai: WorkersAiLike,
  image: Uint8Array,
  defs: AttributeDefinitionDto[],
  product: { title: string },
): Promise<{ lines: string[]; suggestions: AttributeSuggestion[] }> {
  const result = await ai.run(VISION_MODEL, { prompt: PROMPT, image: [...image], max_tokens: 400 })
  const text = typeof result === "string" ? result : (result.response ?? "")
  const lines = cleanSpecLines(text)
  if (!lines.length) return { lines, suggestions: [] }
  const suggestions = await suggestAttributes(ai, defs, { title: product.title, description: lines.join("\n") })
  return { lines, suggestions }
}

/** "data:image/jpeg;base64,..." → bytes, or null when it isn't a small JPEG/PNG/WebP. */
export function imageFromDataUrl(dataUrl: string, maxBytes = 3_000_000): Uint8Array | null {
  const m = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim())
  if (!m) return null
  const b64 = m[2]!
  if ((b64.length * 3) / 4 > maxBytes) return null
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
