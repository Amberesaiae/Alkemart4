/**
 * One-off art repair: crop the stock-photographer watermark off the
 * electronics category images.
 *
 * The watermark sits in the bottom-right corner of both source photos
 * (`stablediffusionweb`, visible on the home mosaic and every product tile
 * that falls back to category art). Cropping the bottom 12% removes it while
 * keeping the flat-lay composition intact; the images re-encode to the same
 * filenames so no code or reference changes.
 *
 * Usage: node scripts/crop-watermark.mjs   (idempotent — no-op if a
 * .pre-crop backup already exists for a file)
 */
import sharp from "sharp"
import { existsSync } from "node:fs"
import { rename } from "node:fs/promises"

const CROPS = [
  { file: "public/images/categories/electronics-source.jpg", type: "jpeg", quality: 88 },
  { file: "public/images/categories/electronics.webp", type: "webp", quality: 84 },
]

const KEEP = 0.88 // crop away the bottom 12%

for (const { file, type, quality } of CROPS) {
  const backup = `${file}.pre-crop`
  if (!existsSync(backup)) {
    await rename(file, backup)
  }
  const img = sharp(backup)
  const meta = await img.metadata()
  const height = Math.round(meta.height * KEEP)
  await img
    .extract({ left: 0, top: 0, width: meta.width, height })
    .toFormat(type, { quality })
    .toFile(file)
  const out = await sharp(file).metadata()
  console.log(`${file}: ${meta.width}x${meta.height} -> ${out.width}x${out.height}`)
}
