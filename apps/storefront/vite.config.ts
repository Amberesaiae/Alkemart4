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
  },
  server: {
    port: Number(process.env.PORT ?? "5175"),
    strictPort: true,
    host: "0.0.0.0",
    // No /api proxy — dual-home forbidden.
  },
  preview: {
    port: Number(process.env.PORT ?? "5175"),
    host: "0.0.0.0",
  },
})
