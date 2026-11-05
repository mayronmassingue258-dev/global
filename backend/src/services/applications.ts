import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { applicationDocuments, applicationEvents, applications, scholarships } from "../db/schema.js";
import { notFound, validationFailed } from "../lib/errors.js";
import type { ApplicationPatch } from "../lib/validation.js";

/** Edições seguidas nas notas em até 10 minutos viram um único evento (mesma regra do frontend). */
const NOTES_MERGE_WINDOW_MS = 10 * 60 * 1000;

type Event = typeof applicationEvents.$inferSelect;

function toEvent(e: Event) {
  const at = e.at.toISOString();
  if (e.kind === "status") return { at, kind: "status" as const, status: e.status! };
  if (e.kind === "document") return { at, kind: "document" as const, document: e.document!, done: e.done! };
  return { at, kind: e.kind as "created" | "notes" };
}

/** Monta o objeto `Application` do contrato para uma ou várias candidaturas do estudante (3 consultas no total). */
async function load(db: Database, userId: string, scholarshipIds?: string[]) {
  const scope = scholarshipIds ? and(eq(applications.userId, userId), inArray(applications.scholarshipId, scholarshipIds)) : eq(applications.userId, userId);
  const apps = await db
    .select({ app: applications, s: { id: scholarships.id, title: scholarships.title, institution: scholarships.institution, deadline: scholarships.deadline } })
    .from(applications)
    .innerJoin(scholarships, eq(scholarships.id, applications.scholarshipId))
    .where(scope)
    .orderBy(asc(applications.createdAt));
  if (apps.length === 0) return [];
  const ids = apps.map((a) => a.app.scholarshipId);
  const [docs, events] = await Promise.all([
    db.select().from(applicationDocuments)
      .where(and(eq(applicationDocuments.userId, userId), inArray(applicationDocuments.scholarshipId, ids)))
      .orderBy(asc(applicationDocuments.position)),
    db.select().from(applicationEvents)
      .where(and(eq(applicationEvents.userId, userId), inArray(applicationEvents.scholarshipId, ids)))
      .orderBy(asc(applicationEvents.id))
  ]);
  return apps.map(({ app, s }) => ({
    id: app.scholarshipId,
    scholarship: s,
    status: app.status,
    documents: docs.filter((d) => d.scholarshipId === app.scholarshipId).map((d) => ({ name: d.name, done: d.done })),
    notes: app.notes,
    timeline: events.filter((e) => e.scholarshipId === app.scholarshipId).map(toEvent),
    updatedAt: app.updatedAt.toISOString()
  }));
}

export const listApplications = (db: Database, userId: string) => load(db, userId);

export async function getApplication(db: Database, userId: string, id: string) {
  const [app] = await load(db, userId, [id]);
  return app ?? null;
}

/** Idempotente: devolve `created: false` se a bolsa já estava salva. */
export async function createApplication(db: Database, userId: string, scholarshipId: string) {
  const created = await db.transaction(async (tx) => {
    const [s] = await tx.select({ docs: scholarships.requiredDocuments }).from(scholarships).where(eq(scholarships.id, scholarshipId)).limit(1);
    if (!s) throw validationFailed({ scholarshipId: "not_found" });
    const inserted = await tx.insert(applications).values({ userId, scholarshipId }).onConflictDoNothing().returning({ id: applications.scholarshipId });
    if (inserted.length === 0) return false;
    if (s.docs.length > 0) {
      await tx.insert(applicationDocuments).values(s.docs.map((name, position) => ({ userId, scholarshipId, name, position })));
    }
    await tx.insert(applicationEvents).values({ userId, scholarshipId, kind: "created" });
    return true;
  });
  return { created, application: (await getApplication(db, userId, scholarshipId))! };
}

/** Atualização parcial; só mudanças reais geram eventos. Tudo numa transação, com a linha travada (FOR UPDATE). */
export async function patchApplication(db: Database, userId: string, id: string, patch: ApplicationPatch) {
  await db.transaction(async (tx) => {
    const where = and(eq(applications.userId, userId), eq(applications.scholarshipId, id));
    const [app] = await tx.select().from(applications).where(where).for("update").limit(1);
    if (!app) throw notFound();
    const now = new Date();
    let changed = false;

    if (patch.status !== undefined && patch.status !== app.status) {
      await tx.update(applications).set({ status: patch.status }).where(where);
      await tx.insert(applicationEvents).values({ userId, scholarshipId: id, at: now, kind: "status", status: patch.status });
      changed = true;
    }

    if (patch.documents) {
      const docs = await tx.select().from(applicationDocuments)
        .where(and(eq(applicationDocuments.userId, userId), eq(applicationDocuments.scholarshipId, id)))
        .orderBy(asc(applicationDocuments.position));
      const wanted = new Map(patch.documents.map((d) => [d.name, d.done]));
      for (const doc of docs) {
        const done = wanted.get(doc.name);
        if (done === undefined || done === doc.done) continue;
        await tx.update(applicationDocuments).set({ done })
          .where(and(eq(applicationDocuments.userId, userId), eq(applicationDocuments.scholarshipId, id), eq(applicationDocuments.name, doc.name)));
        await tx.insert(applicationEvents).values({ userId, scholarshipId: id, at: now, kind: "document", document: doc.name, done });
        changed = true;
      }
    }

    if (patch.notes !== undefined && patch.notes !== app.notes) {
      await tx.update(applications).set({ notes: patch.notes }).where(where);
      const [last] = await tx.select().from(applicationEvents)
        .where(and(eq(applicationEvents.userId, userId), eq(applicationEvents.scholarshipId, id)))
        .orderBy(desc(applicationEvents.id)).limit(1);
      if (last?.kind === "notes" && now.getTime() - last.at.getTime() < NOTES_MERGE_WINDOW_MS) {
        await tx.update(applicationEvents).set({ at: now }).where(eq(applicationEvents.id, last.id));
      } else {
        await tx.insert(applicationEvents).values({ userId, scholarshipId: id, at: now, kind: "notes" });
      }
      changed = true;
    }

    if (changed) await tx.update(applications).set({ updatedAt: now }).where(where);
  });
  return (await getApplication(db, userId, id))!;
}

/** Documentos e eventos são apagados em cascata pela base. */
export async function deleteApplication(db: Database, userId: string, id: string) {
  const deleted = await db.delete(applications).where(and(eq(applications.userId, userId), eq(applications.scholarshipId, id))).returning({ id: applications.scholarshipId });
  if (deleted.length === 0) throw notFound();
}
