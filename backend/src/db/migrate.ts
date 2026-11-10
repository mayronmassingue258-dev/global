import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { loadConfig } from "../config.js";
import { createDb } from "./client.js";

/** Aplica as migrações SQL pendentes (pasta drizzle/). Seguro rodar várias vezes. Usado no deploy antes de iniciar. */
export async function runMigrations(url: string, ssl = false, prepare = true) {
  const here = dirname(fileURLToPath(import.meta.url));
  // Funciona tanto em src/ (tsx) quanto em dist/ (build): a pasta drizzle/ fica na raiz do backend.
  const folder = join(here, "..", "..", "drizzle");
  const { db, sql } = createDb(url, { ssl, max: 1, prepare });
  try {
    await migrate(db, { migrationsFolder: folder });
  } finally {
    await sql.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    process.loadEnvFile(new URL("../../.env", import.meta.url));
  } catch {
    // sem .env
  }
  const config = loadConfig();
  await runMigrations(config.DATABASE_URL, config.DATABASE_SSL === "require", config.DATABASE_PREPARE === "1");
  console.log("Migrações aplicadas.");
}
