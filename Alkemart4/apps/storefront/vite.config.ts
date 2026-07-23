import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "path"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import { VitePWA } from "vite-plugin-pwa"

/**
 * Greenfield buyer storefront.
 * - No Express /api proxy (no dual-home).
 * - Commerce config only from env (no hardcoded IDs/keys).
 * - Port 5175: single buyer URL (greenfield storefront). Lab SPA should not run at the same time.
 */
export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: path.resolve(import.meta.dirname, "src/routes"),
      generatedRouteTree: path.resolve(import.meta.dirname, "src/routeTree.gen.ts"),
    }),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      // Inject the service worker registration into index.html automatically
      injectRegister: "auto",
      // Strategy: generate the SW with Workbox
      strategies: "generateSW",
      // Point Vercel (and browsers) at the manifest we wrote manually
      manifest: false,
      manifestFilename: "manifest.webmanifest",
      includeAssets: ["offline.html", "icons/*.png", "favicon.ico"],
      workbox: {
        // Shell: always network-first so deploys propagate quickly
        navigateFallback: "/offline.html",
        navigateFallbackDenylist: [/^\/api\//],
        // API calls: network-first, 10s timeout → cache → offline
        runtimeCaching: [
          {
            // Medusa / Railway API
            urlPattern: ({ url }) =>
              url.hostname.endsWith(".railway.app") ||
              url.hostname.endsWith(".up.railway.app"),
            handler: "NetworkFirst",
            options: {
              cacheName:        "api-cache",
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Product images / media (S3/CDN) — cache-first, 7-day TTL
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Google Fonts — stale-while-revalidate
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        // Pre-cache the compiled app shell (JS/CSS chunks)
        globPatterns: ["**/*.{js,css,html,woff2}"],
      },
      devOptions: {
        // Show SW behaviour in dev (disable if it causes confusion)
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    target: "es2020",
    cssCodeSplit: true,
    modulePreload: { polyfill: true },
    rollupOptions: {
      output: {
        /**
         * Split heavy vendors so the critical path is smaller and cacheable.
         * PostHog / Medusa no longer force a single 750KB main chunk.
         */
        manualChunks(id) {
          if (!id.includes("node_modules")) return
          if (id.includes("posthog")) return "vendor-posthog"
          if (id.includes("@medusajs") || id.includes("medusa"))
            return "vendor-medusa"
          if (id.includes("@sentry")) return "vendor-sentry"
          if (id.includes("@tanstack")) return "vendor-tanstack"
          if (
            id.includes("react-dom") ||
            id.includes("/react/") ||
            id.endsWith("/react/index.js") ||
            id.includes("scheduler")
          ) {
            return "vendor-react"
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: Number(process.env.PORT ?? "5175"),
    strictPort: true,
    host: "0.0.0.0",
  },
  preview: {
    port: Number(process.env.PORT ?? "5175"),
    host: "0.0.0.0",
  },
})
