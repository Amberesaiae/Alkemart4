// @deprecated — stub route, no behavior
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

export async function GET(
  _req: MedusaRequest,
  res: MedusaResponse
) {
  res.sendStatus(200);
}
