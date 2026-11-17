import { fileURLToPath } from "node:url";
import { eq, sql } from "drizzle-orm";
import { loadConfig } from "../config.js";
import { createDb, type Database } from "./client.js";
import { users } from "./schema.js";

/**
 * Dá (ou tira) acesso ao painel de administração das bolsas. A pessoa precisa já ter conta no site.
 *
 *   npm run admin:grant -- pessoa@exemplo.com
 *   npm run admin:grant -- pessoa@exemplo.com --revoke
 */
export async function setRole(db: Database, email: string, role: "admin" | "student") {
  const rows = await db.update(users).set({ role }).where(eq(sql`lower(${users.email})`, email.trim().toLowerCase())).returning({ id: users.id });
  return rows.length > 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    process.loadEnvFile(new URL("../../.env", import.meta.url));
  } catch {
    // sem .env
  }
  const args = process.argv.slice(2);
  const email = args.find((a) => !a.startsWith("--"));
  if (!email) {
    console.error("Uso: npm run admin:grant -- email@exemplo.com [--revoke]");
    process.exit(1);
  }
  const config = loadConfig();
  const { db, sql: connection } = createDb(config.DATABASE_URL, { ssl: config.DATABASE_SSL === "require", prepare: config.DATABASE_PREPARE === "1", max: 1 });
  const role = args.includes("--revoke") ? "student" : "admin";
  const ok = await setRole(db, email, role);
  await connection.end();
  if (!ok) {
    console.error("Nenhuma conta com esse e-mail. A pessoa precisa criar a conta no site primeiro.");
    process.exit(1);
  }
  console.log(role === "admin" ? "Pronto: a conta agora é administradora (saia e entre de novo no site)." : "Pronto: acesso de administração removido.");
}
