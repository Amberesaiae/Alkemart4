import { defineConfig } from "orval"

export default defineConfig({
  alkemart: {
    input: {
      target: "../api-spec/openapi.yaml",
    },
    output: {
      target: "./src/generated/api.ts",
      schemas: "./src/generated/model",
      client: "fetch",
      mode: "split",
      clean: true,
      prettier: false,
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
        },
        mutator: {
          path: "./src/http.ts",
          name: "customFetch",
        },
      },
    },
  },
})
