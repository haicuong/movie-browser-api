import { defineConfig, configDefaults } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig({
  test: {
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: [...configDefaults.exclude, "src/sandbox/**"],
    fileParallelism: false,
    setupFiles: ["src/test/setup.ts"],
    env: loadEnv("test", process.cwd(), ""),
  },
});
