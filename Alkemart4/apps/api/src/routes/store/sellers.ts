import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import type { AppEnv } from "../../context"

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
    return c.json(shop)
  })
