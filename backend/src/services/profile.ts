import { eq, sql } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { profiles } from "../db/schema.js";
import { profileCompleteness } from "../matching/engine.js";
import { sanitizeProfile, type StudentProfile } from "../matching/model.js";

export type ProfileResponse = StudentProfile & { completeness: { percent: number; missing: string[] }; updatedAt?: string };

function toResponse(row: typeof profiles.$inferSelect | undefined): ProfileResponse {
  const profile = sanitizeProfile(row?.data);
  return { ...profile, completeness: profileCompleteness(profile), ...(row?.updatedAt ? { updatedAt: row.updatedAt.toISOString() } : {}) };
}

export async function loadProfile(db: Database, userId: string): Promise<StudentProfile> {
  const [row] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return sanitizeProfile(row?.data);
}

/** Sempre devolve todos os campos (vazios se o estudante ainda não salvou nada): nunca 404. */
export async function getProfile(db: Database, userId: string) {
  const [row] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return toResponse(row);
}

/** Substitui o perfil inteiro (o formulário envia todos os campos a cada etapa). */
export async function putProfile(db: Database, userId: string, input: StudentProfile) {
  const [row] = await db.insert(profiles).values({ userId, data: input, updatedAt: sql`now()` })
    .onConflictDoUpdate({ target: profiles.userId, set: { data: input, updatedAt: sql`now()` } })
    .returning();
  return toResponse(row);
}
