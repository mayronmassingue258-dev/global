import { sql } from "drizzle-orm";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createDb } from "../src/db/client.js";
import { seed } from "../src/db/seed.js";

/** Aplicação ligada à base de teste, com função para zerar os dados entre testes. */
export async function setupTestApp() {
  const config = loadConfig({ ...process.env, ALLOW_TEST_RESET: "0" });
  const { db, sql: connection } = createDb(config.DATABASE_URL, { max: 2 });
  const app = await buildApp({ config, db });
  const reset = async () => {
    await db.execute(sql`truncate application_events, application_documents, applications, drafts, profiles, eligibility_criteria, scholarships, users restart identity cascade`);
    await seed(db);
  };
  const close = async () => {
    await app.close();
    await connection.end();
  };
  /** Atalho para chamadas JSON. */
  const call = async (path: string, init: { method?: string; body?: unknown; raw?: string } = {}) => {
    const res = await app.inject({
      method: (init.method ?? "GET") as "GET",
      url: `/api${path}`,
      ...(init.raw !== undefined ? { payload: init.raw, headers: { "content-type": "application/json" } } : {}),
      ...(init.body !== undefined ? { payload: init.body as object } : {})
    });
    return { status: res.statusCode, headers: res.headers, json: res.body ? JSON.parse(res.body) : undefined };
  };
  return { app, db, reset, close, call };
}
