// vitest.config.mts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts", "convex/**/__tests__/**/*.test.ts", "agent/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/lib/**", "convex/**"],
      exclude: ["convex/_generated/**", "**/__tests__/**", "convex/tsconfig.json"],
    },
  },
});
