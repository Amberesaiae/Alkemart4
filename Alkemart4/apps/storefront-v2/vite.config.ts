import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import { defineConfig } from "vite"

/**
 * `--mode live`: local UI over the live catalogue, for design review with
 * real departments, shops and photos. The live API doesn't allow localhost
 * origins, so the dev server proxies it — and only reads: anything but
 * GET/HEAD is refused before it leaves the machine (no carts, sign-ins or
 * orders in production from a laptop).
 */
const LIVE_API = "https://api.alkemart.com"
const LIVE_PORT = 5196

/** Storefront v2 — Workers-only buyer storefront (port 5176). */
export default defineConfig(({ mode }) => {
  const live = mode === "live"
  if (live) {
    // Set before Vite reads .env files; existing variables win over them, so
    // .env.local's localhost API can't sneak back in.
    Object.assign(process.env, {
      VITE_ALKEMART_API_URL: `http://localhost:${LIVE_PORT}/live-api`,
      VITE_MARKET_CODE: "GH",
      VITE_STOREFRONT_URL: `http://localhost:${LIVE_PORT}`,
      VITE_VENDOR_APP_URL: "https://sell.alkemart.com",
      // Production signs in through WorkOS; match it (sign-in POSTs stay blocked by the proxy).
      VITE_WORKOS_ENABLED: "1",
    })
  }
  return {
    base: process.env.BASE_PATH ?? "/",
    plugins: [
      tanstackRouter({ target: "react", autoCodeSplitting: true }),
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom"],
    },
    server: {
      port: live ? LIVE_PORT : Number(process.env.PORT ?? "5176"),
      strictPort: true,
      host: "0.0.0.0",
      proxy: live
        ? {
            "/live-api": {
              target: LIVE_API,
              changeOrigin: true,
              rewrite: (p) => p.replace(/^\/live-api/, ""),
              // Returning false makes Vite answer 404 instead of forwarding.
              bypass: (req) => (req.method === "GET" || req.method === "HEAD" ? undefined : false),
            },
          }
        : undefined,
    },
    preview: {
      port: Number(process.env.PORT ?? "5176"),
      host: "0.0.0.0",
    },
  }
})
