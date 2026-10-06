import { defineConfig } from "vitest/config";
export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
    maxWorkers: 2,
    testTimeout: 10000,
    reporters: ["default", "json"],
    outputFile: { json: "tests/.results/vitest.json" },
  },
});
