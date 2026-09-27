import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import { defineConfig } from "vite"

/** Storefront v2 — Workers-only buyer storefront (port 5176). */
export default defineConfig({
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
    port: Number(process.env.PORT ?? "5176"),
    strictPort: true,
    host: "0.0.0.0",
  },
  preview: {
    port: Number(process.env.PORT ?? "5176"),
    host: "0.0.0.0",
  },
})
