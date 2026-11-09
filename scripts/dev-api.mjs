#!/usr/bin/env node
// `npm run dev:api` → sobe a API local (porta 4000) e o Next em modo API real (porta 3000), juntos.
// Funciona em Windows, macOS e Linux (não depende de sintaxe de shell para variáveis de ambiente).
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const apiPort = process.env.MOCK_API_PORT || "4000";

const children = [
  spawn(process.execPath, ["mock-api/server.mjs"], { stdio: "inherit", env: { ...process.env, PORT: apiPort } }),
  spawn(process.execPath, [nextBin, "dev"], {
    stdio: "inherit",
    env: { ...process.env, NEXT_PUBLIC_DATA_MODE: "api", NEXT_PUBLIC_API_BASE_URL: "/api", API_INTERNAL_URL: `http://localhost:${apiPort}` }
  })
];

const stop = (code = 0) => {
  for (const child of children) if (child.exitCode === null) child.kill("SIGTERM");
  process.exit(code);
};
for (const child of children) child.on("exit", (code) => stop(code ?? 0));
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
