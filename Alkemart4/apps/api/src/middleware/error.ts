import type { ErrorHandler } from "hono"
import { HTTPException } from "hono/http-exception"

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message || "error" }, err.status)
  }
  console.error(err)
  return c.json({ error: "internal_error" }, 500)
}
