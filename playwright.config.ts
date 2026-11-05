import { defineConfig, devices } from "@playwright/test";

/**
 * Ponta a ponta: build de PRODUÇÃO do Next em modo API real + backend real (backend/) com PostgreSQL.
 * Primeira vez na sua máquina: `npx playwright install chromium`.
 */
const API_PORT = 4010;
const WEB_PORT = 3100;
export const API_URL = `http://127.0.0.1:${API_PORT}/api`;
const USE_MOCK_API = process.env.E2E_BACKEND === "mock";
/** Base PostgreSQL só para os testes (é zerada antes de cada teste). */
const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://postgres@127.0.0.1:5433/globalscholar_e2e";
const CI = Boolean(process.env.CI);
// Os servidores NUNCA são reaproveitados: um build antigo na porta 3100 faria os testes mentirem.
// Se a porta estiver ocupada, o Playwright falha avisando; feche o processo e rode de novo.

export default defineConfig({
  testDir: "./e2e",
  // Todos os testes compartilham um único "estudante" na API local: rodam em série.
  fullyParallel: false,
  workers: 1,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    locale: "pt-BR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /smoke\.spec\.ts/ }
  ],
  webServer: [
    // Padrão: backend REAL (backend/) com PostgreSQL. E2E_BACKEND=mock usa a API local sem base de dados.
    USE_MOCK_API
      ? {
          command: "node mock-api/server.mjs",
          url: `${API_URL}/health`,
          env: { PORT: String(API_PORT), MOCK_API_DATA_FILE: "mock-api/.data/e2e-db.json", MOCK_API_LOG: "0" },
          reuseExistingServer: false,
          timeout: 20_000
        }
      : {
          command: "npm --prefix backend run db:migrate && npx --prefix backend tsx backend/src/server.ts",
          url: `${API_URL}/health`,
          env: {
            PORT: String(API_PORT),
            HOST: "127.0.0.1",
            DATABASE_URL: E2E_DATABASE_URL,
            ALLOW_TEST_RESET: "1",
            CORS_ORIGIN: `http://localhost:${WEB_PORT}`,
            LOG_LEVEL: "warn",
            NODE_ENV: "test"
          },
          reuseExistingServer: false,
          timeout: 60_000
        },
    {
      command: `npx next build && npx next start -p ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}`,
      env: { NEXT_DIST_DIR: ".next-e2e", NEXT_PUBLIC_DATA_MODE: "api", NEXT_PUBLIC_API_BASE_URL: API_URL, NEXT_TELEMETRY_DISABLED: "1" },
      reuseExistingServer: false,
      timeout: 240_000,
      stdout: "ignore",
      stderr: "pipe"
    }
  ]
});
