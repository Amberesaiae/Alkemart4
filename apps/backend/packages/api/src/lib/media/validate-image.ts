/**
 * Sync validation for vendor image uploads (mime, size, magic bytes).
 * Derivatives (sharp thumbs) are async jobs (PR9) — not here.
 */

export const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
])

/** Max upload size bytes (default 5 MiB). */
export const MAX_IMAGE_BYTES = Number(
  process.env.ALKEMART_MAX_IMAGE_BYTES || 5 * 1024 * 1024,
)

export type ImageValidationOk = { ok: true }
export type ImageValidationErr = { ok: false; error: string }
export type ImageValidationResult = ImageValidationOk | ImageValidationErr

function isJpeg(buf: Buffer): boolean {
  return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
}

function isPng(buf: Buffer): boolean {
  return (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  )
}

function isWebp(buf: Buffer): boolean {
  // RIFF....WEBP
  return (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  )
}

export function detectImageMimeFromBuffer(buf: Buffer): string | null {
  if (isJpeg(buf)) return "image/jpeg"
  if (isPng(buf)) return "image/png"
  if (isWebp(buf)) return "image/webp"
  return null
}

export function validateImageUpload(opts: {
  mime?: string | null
  size?: number | null
  buffer?: Buffer | null
  filename?: string | null
}): ImageValidationResult {
  const size = opts.size ?? opts.buffer?.length ?? 0
  if (size <= 0) {
    return { ok: false, error: "Empty file" }
  }
  if (size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: `Image exceeds max size of ${Math.floor(MAX_IMAGE_BYTES / (1024 * 1024))}MB`,
    }
  }

  let mime = (opts.mime || "").toLowerCase().split(";")[0].trim()
  if (opts.buffer && opts.buffer.length >= 12) {
    const detected = detectImageMimeFromBuffer(opts.buffer)
    if (detected) {
      // Prefer magic bytes over client-declared mime
      if (mime && mime !== detected && !(mime === "image/jpg" && detected === "image/jpeg")) {
        return {
          ok: false,
          error: `MIME mismatch: declared ${mime}, detected ${detected}`,
        }
      }
      mime = detected
    } else if (mime && ALLOWED_IMAGE_MIMES.has(mime)) {
      // Client mime ok but magic failed — reject untrusted content
      return { ok: false, error: "File content is not a valid JPEG, PNG, or WebP" }
    }
  }

  if (!mime || !ALLOWED_IMAGE_MIMES.has(mime === "image/jpg" ? "image/jpeg" : mime)) {
    return {
      ok: false,
      error: "Only JPEG, PNG, and WebP images are allowed",
    }
  }

  const name = (opts.filename || "").toLowerCase()
  if (name) {
    const extOk =
      name.endsWith(".jpg") ||
      name.endsWith(".jpeg") ||
      name.endsWith(".png") ||
      name.endsWith(".webp")
    if (!extOk) {
      return {
        ok: false,
        error: "Filename must end with .jpg, .jpeg, .png, or .webp",
      }
    }
  }

  return { ok: true }
}
