import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import type { AppEnv } from "../../context"
import { trackView } from "../../traffic"

export const sellers = new Hono<AppEnv>()
  .get("/", async (c) => {
    const sellersList = await c.get("repo").listOpenSellers()
    return c.json({
      sellers: sellersList,
      items: sellersList,
    })
  })
  .get("/:handle", async (c) => {
    const shop = await c.get("repo").getSellerShop(c.req.param("handle"))
    if (!shop) throw new HTTPException(404, { message: "seller not found" })
    // Fire-and-forget traffic counter; reads never wait on it.
    trackView(c, shop.seller.id, null)
    const featuredProductIds = await c.get("featured").listFeatured(shop.seller.id).catch(() => [])
    // Branding lives on the seller profile (logo/banner/bio), not the
    // catalog snapshot — attach it so shop heroes render real art.
    const profile = await c.get("authRepo").findSellerById(shop.seller.id).catch(() => null)
    return c.json({
      ...shop,
      seller: {
        ...shop.seller,
        description: profile?.description ?? null,
        logo: profile?.logo ?? null,
        banner: profile?.banner ?? null,
      },
      featuredProductIds,
    })
  })
