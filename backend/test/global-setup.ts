import { runMigrations } from "../src/db/migrate.js";

/** Aplica as migrações na base de TESTE uma vez antes de todos os testes. */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://postgres@127.0.0.1:5433/globalscholar_test";
  await runMigrations(url);
}
