import { Hono } from "hono"
import type { ApiEnv } from "./env"
import { health } from "./routes/health"

const app = new Hono<{ Bindings: ApiEnv }>()
app.route("/health", health)

export default app
