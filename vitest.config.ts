import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@raycast/api": path.resolve(__dirname, "tests/__mocks__/@raycast/api.ts"),
    },
  },
  test: {
    coverage: {
      provider: "v8",
    },
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
  },
});
