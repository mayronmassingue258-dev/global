import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDb } from "./db/client.js";
import { applicationEvents, applications, drafts, profiles } from "./db/schema.js";
import { seed } from "./db/seed.js";

// Desenvolvimento: lê backend/.env se existir (em produção as variáveis vêm do Render).
try {
  process.loadEnvFile(new URL("../.env", import.meta.url));
} catch {
  // sem .env: segue com as variáveis do ambiente
}

const config = loadConfig();
const { db, sql: connection } = createDb(config.DATABASE_URL, { ssl: config.DATABASE_SSL === "require" });

/** Apaga os dados dos estudantes e recria os de demonstração. Só registrado com ALLOW_TEST_RESET=1. */
async function resetDatabase() {
  await db.transaction(async (tx) => {
    await tx.delete(applicationEvents);
    await tx.delete(applications);
    await tx.delete(drafts);
    await tx.delete(profiles);
  });
  await seed(db);
}

const app = await buildApp({ config, db, resetDatabase });
if (config.SEED_DEMO_DATA === "1") await seed(db); // bolsas fictícias de demonstração (idempotente)
await app.listen({ port: config.PORT, host: config.HOST });

const stop = async () => {
  await app.close();
  await connection.end();
  process.exit(0);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
