import { fileURLToPath } from "node:url";
import { loadConfig } from "../config.js";
import { createDb, type Database } from "./client.js";
import { scholarshipInput, upsertScholarship } from "./import-scholarships.js";
import scholarshipData from "./seed-data/scholarships.json" with { type: "json" };

/** Insere/atualiza as bolsas FICTÍCIAS de demonstração ("amostra-*"). Idempotente. */
export async function seed(db: Database) {
  for (const raw of scholarshipData) await upsertScholarship(db, scholarshipInput.parse(raw), "demo");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    process.loadEnvFile(new URL("../../.env", import.meta.url));
  } catch {
    // sem .env
  }
  const config = loadConfig();
  const { db, sql } = createDb(config.DATABASE_URL, { ssl: config.DATABASE_SSL === "require", prepare: config.DATABASE_PREPARE === "1", max: 1 });
  await seed(db);
  await sql.end();
  console.log("Dados de demonstração inseridos.");
}
