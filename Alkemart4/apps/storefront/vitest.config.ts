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
    // Component tests render, so they need a DOM. Pure helpers are unaffected
    // by running in one.
    environment: "happy-dom",
    // Co-located component tests count too, not just src/lib. The .tsx half of
    // this glob was missing, so every *.test.tsx was silently skipped — vitest
    // reports "no test files found" for an excluded path rather than failing.
    include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
  },
})
