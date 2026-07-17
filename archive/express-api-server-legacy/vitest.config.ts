import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Concurrency-race tests hit the real Paystack sandbox over the
    // network and share a single Postgres database, so they must run
    // sequentially and get a generous timeout.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
