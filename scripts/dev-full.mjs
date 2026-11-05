#!/usr/bin/env node
// `npm run dev:full` → backend real (backend/, porta 4000, PostgreSQL) + frontend em modo API (porta 3000).
// Pré-requisitos: `docker compose up -d` (PostgreSQL), `npm --prefix backend install` e backend/.env (copie de .env.example).
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

if (!existsSync("backend/.env")) {
  console.error("Falta backend/.env. Copie backend/.env.example para backend/.env e rode de novo.");
  process.exit(1);
}
const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

const children = [
  spawn(npm, ["--prefix", "backend", "run", "db:migrate"], { stdio: "inherit", shell: process.platform === "win32" })
];
children[0].on("exit", (code) => {
  if (code !== 0) {
    console.error("Não foi possível aplicar as migrações. O PostgreSQL está rodando (docker compose up -d)?");
    process.exit(code ?? 1);
  }
  children.push(
    spawn(npm, ["--prefix", "backend", "run", "dev"], { stdio: "inherit", shell: process.platform === "win32" }),
    spawn(process.execPath, [nextBin, "dev"], {
      stdio: "inherit",
      env: { ...process.env, NEXT_PUBLIC_DATA_MODE: "api", NEXT_PUBLIC_API_BASE_URL: "http://localhost:4000/api" }
    })
  );
  for (const child of children.slice(1)) child.on("exit", (c) => stop(c ?? 0));
});

const stop = (code = 0) => {
  for (const child of children) if (child.exitCode === null) child.kill("SIGTERM");
  process.exit(code);
};
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
