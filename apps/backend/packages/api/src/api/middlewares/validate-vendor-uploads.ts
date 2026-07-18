/**
 * Validate multipart image uploads on /vendor/uploads after multer.
 * Rejects non-images / oversize before uploadFilesWorkflow runs.
 */
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { validateImageUpload } from "../../lib/media/validate-image"

type UploadFile = {
  originalname?: string
  mimetype?: string
  size?: number
  buffer?: Buffer
}

export async function validateVendorUploads(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  const files = (req as MedusaRequest & { files?: UploadFile[] }).files
  if (!files?.length) {
    next()
    return
  }

  for (const f of files) {
    const result = validateImageUpload({
      mime: f.mimetype,
      size: f.size ?? f.buffer?.length,
      buffer: f.buffer ?? null,
      filename: f.originalname,
    })
    if (!result.ok) {
      res.status(400).json({
        type: "invalid_data",
        message: result.error,
        error: result.error,
      })
      return
    }
  }

  next()
}
