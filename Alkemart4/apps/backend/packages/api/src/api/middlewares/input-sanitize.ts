import type { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http"

const HTML_TAG_RE = /<[^>]*>/g
const SCRIPT_RE = /<script[\s>]/i
const ON_EVENT_RE = /\son\w+\s*=/i
const JS_PROTOCOL_RE = /javascript\s*:/i

function sanitizeString(value: string): string {
  if (SCRIPT_RE.test(value) || ON_EVENT_RE.test(value) || JS_PROTOCOL_RE.test(value)) {
    return value.replace(HTML_TAG_RE, "")
  }
  return value
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") return sanitizeString(value)
  if (Array.isArray(value)) return value.map(sanitizeValue)
  if (value && typeof value === "object") return sanitizeObject(value as Record<string, unknown>)
  return value
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(obj)) {
    result[key] = sanitizeValue(val)
  }
  return result
}

export function inputSanitize(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction,
) {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body as Record<string, unknown>)
  }
  if (req.query && typeof req.query === "object") {
    for (const key of Object.keys(req.query)) {
      const val = req.query[key]
      if (typeof val === "string") {
        req.query[key] = sanitizeString(val)
      }
    }
  }
  next()
}
