import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Disk-backed delivery/Apply fixtures and native builds share this laptop
    // with the bridge. The 19-worker default causes measured full-suite
    // deadline failures; bound scheduling without changing tests or deadlines.
    maxWorkers: 2,
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    setupFiles: ["tests/setup/blockPaidApis.ts"],
    passWithNoTests: false,
  },
});
