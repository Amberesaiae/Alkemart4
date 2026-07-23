import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "path"
import { tanstackRouter } from "@tanstack/router-plugin/vite"

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
