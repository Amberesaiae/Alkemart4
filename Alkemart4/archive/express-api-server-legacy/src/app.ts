import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import webhookRouter from "./routes/webhooks";
import router from "./routes";
import { logger } from "./lib/logger";
import { cartSessionMiddleware } from "./middlewares/cart-session";
import { authSessionMiddleware } from "./middlewares/auth-session";

const app: Express = express();

// ── Security headers ──────────────────────────────────────────────────────
app.use(helmet());

// ── Rate limiting ──────────────────────────────────────────────────────────
// Global: 200 requests per minute per IP
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later" },
  }),
);

// Stricter: auth endpoints — 10 attempts per minute
const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth attempts, please try again later" },
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/signup", authLimiter);
app.use("/api/auth/password", authLimiter);

// ── Request logging ────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// ── CORS ───────────────────────────────────────────────────────────────────
app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());

// ── Webhook raw body (before express.json) ─────────────────────────────────
app.use("/api/webhooks", express.raw({ type: "application/json" }), (req, _res, next) => {
  (req as any).rawBody = req.body;
  next();
});

// ── Body parsing with size limits ──────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ── Session middleware ─────────────────────────────────────────────────────
app.use(cartSessionMiddleware);
app.use(authSessionMiddleware);

// ── Routes ─────────────────────────────────────────────────────────────────
app.use("/api", webhookRouter);
app.use("/api", router);

// ── Global error handler ───────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
  logger.error({ err }, "Unhandled error");

  // Don't leak error details in production
  const message =
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message || "Internal server error";

  res.status(500).json({ error: message });
});

export default app;
