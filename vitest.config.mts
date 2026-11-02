import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  // O tsconfig usa "jsx: preserve" (exigido pelo Next); nos testes o JSX é compilado com o runtime automático.
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "mock-api/**/*.test.mjs"],
    // Valores fixos para os testes: serviço de API real apontando para um endereço fictício (fetch é simulado).
    env: { NEXT_PUBLIC_DATA_MODE: "api", NEXT_PUBLIC_API_BASE_URL: "http://api.test/api" },
    css: { modules: { classNameStrategy: "non-scoped" } },
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}", "mock-api/**/*.mjs"],
      exclude: ["src/**/*.test.*", "src/test/**", "src/app/**", "**/*.d.ts"],
      reporter: ["text-summary", "html"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 }
    }
  }
});
