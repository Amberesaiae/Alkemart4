import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

const CART_COOKIE = "cart_sid";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      cartSessionKey: string;
    }
  }
}

export function cartSessionMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existing = req.cookies?.[CART_COOKIE] as string | undefined;
  if (existing) {
    req.cartSessionKey = existing;
    next();
    return;
  }

  const sessionKey = randomUUID();
  res.cookie(CART_COOKIE, sessionKey, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: ONE_YEAR_MS,
  });
  req.cartSessionKey = sessionKey;
  next();
}
