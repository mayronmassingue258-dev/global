import { sql } from "drizzle-orm";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDb } from "./db/client.js";
import { seed } from "./db/seed.js";
import { purgeExpired } from "./services/auth.js";

// Desenvolvimento: lê backend/.env se existir (em produção as variáveis vêm do Render).
try {
  process.loadEnvFile(new URL("../.env", import.meta.url));
} catch {
  // sem .env: segue com as variáveis do ambiente
}

const config = loadConfig();
const { db, sql: connection } = createDb(config.DATABASE_URL, { ssl: config.DATABASE_SSL === "require" });

/** Apaga TODAS as contas e dados de estudantes e recria as bolsas de demonstração. Só registrado com ALLOW_TEST_RESET=1. */
async function resetDatabase() {
  await db.execute(sql`truncate users, sessions, password_resets, profiles, applications, application_documents, document_files, application_events, drafts restart identity cascade`);
  await seed(db);
}

const app = await buildApp({
  config,
  db,
  resetDatabase,
  // Nos testes de ponta a ponta, muitas contas são criadas do mesmo IP em pouco tempo.
  authRateLimit: config.ALLOW_TEST_RESET === "1" ? 10_000 : 10
});
if (config.SEED_DEMO_DATA === "1") await seed(db); // bolsas fictícias de demonstração (idempotente)
await app.listen({ port: config.PORT, host: config.HOST });

// Limpeza de sessões vencidas e links de senha antigos: na partida e a cada 6 horas.
const purge = () => purgeExpired(db).catch((error) => app.log.error(error));
void purge();
const timer = setInterval(purge, 6 * 60 * 60 * 1000);
timer.unref();

const stop = async () => {
  clearInterval(timer);
  await app.close();
  await connection.end();
  process.exit(0);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
