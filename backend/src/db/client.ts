import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export type Database = ReturnType<typeof createDb>["db"];

/** Conexão com o PostgreSQL. `max` baixo: o plano gratuito do Render aceita poucas conexões simultâneas. */
export function createDb(url: string, options: { ssl?: boolean; max?: number; prepare?: boolean } = {}) {
  const sql = postgres(url, { max: options.max ?? 5, ssl: options.ssl ? "require" : false, prepare: options.prepare ?? true, onnotice: () => undefined });
  const db = drizzle(sql, { schema });
  return { db, sql };
}
