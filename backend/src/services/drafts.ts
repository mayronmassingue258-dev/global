import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { drafts } from "../db/schema.js";
import { notFound } from "../lib/errors.js";
import type { DraftInput } from "../lib/validation.js";

const toDraft = (d: typeof drafts.$inferSelect) => ({
  id: d.id,
  type: d.type,
  title: d.title,
  program: d.program,
  sections: d.sections,
  createdAt: d.createdAt.toISOString(),
  updatedAt: d.updatedAt.toISOString()
});

const mine = (userId: string, id: string) => and(eq(drafts.userId, userId), eq(drafts.id, id));

export async function listDrafts(db: Database, userId: string) {
  const rows = await db.select().from(drafts).where(eq(drafts.userId, userId)).orderBy(desc(drafts.updatedAt));
  return rows.map(toDraft);
}

export async function getDraft(db: Database, userId: string, id: string) {
  const [row] = await db.select().from(drafts).where(mine(userId, id)).limit(1);
  if (!row) throw notFound();
  return toDraft(row);
}

export async function createDraft(db: Database, userId: string, input: DraftInput) {
  const id = `d_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const [row] = await db.insert(drafts).values({ id, userId, ...input }).returning();
  return toDraft(row!);
}

export async function updateDraft(db: Database, userId: string, id: string, input: DraftInput) {
  const [row] = await db.update(drafts).set({ ...input, updatedAt: sql`now()` }).where(mine(userId, id)).returning();
  if (!row) throw notFound();
  return toDraft(row);
}

export async function deleteDraft(db: Database, userId: string, id: string) {
  const deleted = await db.delete(drafts).where(mine(userId, id)).returning({ id: drafts.id });
  if (deleted.length === 0) throw notFound();
}
