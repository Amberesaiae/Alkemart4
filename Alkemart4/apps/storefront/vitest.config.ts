import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    globals: true,
    // Co-located component tests count too, not just src/lib.
    include: ["src/**/__tests__/**/*.test.ts"],
  },
})
