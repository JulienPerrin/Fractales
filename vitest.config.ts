import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/types/**"],
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
    },
  },
});
