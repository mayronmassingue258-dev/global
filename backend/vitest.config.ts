import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
    globalSetup: ["./test/global-setup.ts"],
    // Os testes compartilham uma base: rodam em série.
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://postgres@127.0.0.1:5433/globalscholar_test"
    }
  }
});
