import { eq, sql } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { profiles } from "../db/schema.js";
import { PROFILE_FIELDS, type ProfileInput } from "../lib/validation.js";

const empty = (): ProfileInput => Object.fromEntries(PROFILE_FIELDS.map((k) => [k, ""])) as ProfileInput;

function toProfile(row: typeof profiles.$inferSelect | undefined) {
  if (!row) return empty();
  const out = Object.fromEntries(PROFILE_FIELDS.map((k) => [k, row[k]])) as ProfileInput & { updatedAt?: string };
  if (row.updatedAt) out.updatedAt = row.updatedAt.toISOString();
  return out;
}

/** Sempre devolve todos os campos (vazios se o estudante ainda não salvou nada): nunca 404. */
export async function getProfile(db: Database, userId: string) {
  const [row] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return toProfile(row);
}

export async function putProfile(db: Database, userId: string, input: ProfileInput) {
  const [row] = await db.insert(profiles).values({ userId, ...input, updatedAt: sql`now()` })
    .onConflictDoUpdate({ target: profiles.userId, set: { ...input, updatedAt: sql`now()` } })
    .returning();
  return toProfile(row);
}
