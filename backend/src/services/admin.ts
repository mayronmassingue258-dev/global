import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db/client.js";
import { scholarshipReports, scholarships, users } from "../db/schema.js";
import { scholarshipInput, upsertScholarship } from "../db/import-scholarships.js";
import { HttpError, notFound, validationFailed } from "../lib/errors.js";
import { zodFields } from "../matching/model.js";
import { toScholarship } from "./scholarships.js";

/**
 * Painel de administração das bolsas: listar (inclusive ocultas e reportadas), cadastrar/editar, verificar,
 * ocultar/reativar e resolver erros reportados por estudantes. Só para contas com role = "admin".
 */

export const REPORT_REASONS = ["broken_link", "wrong_deadline", "wrong_info", "closed", "scam", "other"] as const;
/** Motivos graves: com 3 estudantes diferentes reportando, a bolsa sai do ar sozinha até um admin conferir. */
const SERIOUS = ["broken_link", "closed", "scam"] as const;
export const AUTO_HIDE_REPORTS = 3;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function parseReport(body: unknown) {
  const b = isRecord(body) ? body : {};
  const fields: Record<string, string> = {};
  if (!(REPORT_REASONS as readonly unknown[]).includes(b.reason)) fields.reason = b.reason === undefined ? "required" : "invalid_option";
  const message = b.message === undefined ? "" : b.message;
  if (typeof message !== "string") fields.message = "invalid_type";
  else if (message.length > 1000) fields.message = "too_long";
  if (Object.keys(fields).length > 0) throw validationFailed(fields);
  return { reason: b.reason as (typeof REPORT_REASONS)[number], message: (message as string).trim() };
}

export async function createReport(db: Database, userId: string, scholarshipId: string, input: ReturnType<typeof parseReport>) {
  const [row] = await db.select({ id: scholarships.id, status: scholarships.status }).from(scholarships).where(eq(scholarships.id, scholarshipId)).limit(1);
  if (!row) throw notFound();
  // Um relato aberto por estudante e bolsa: repetir só atualiza o motivo (ninguém derruba uma bolsa sozinho).
  const [existing] = await db.select({ id: scholarshipReports.id }).from(scholarshipReports)
    .where(and(eq(scholarshipReports.scholarshipId, scholarshipId), eq(scholarshipReports.userId, userId), isNull(scholarshipReports.resolvedAt))).limit(1);
  if (existing) await db.update(scholarshipReports).set({ reason: input.reason, message: input.message }).where(eq(scholarshipReports.id, existing.id));
  else await db.insert(scholarshipReports).values({ scholarshipId, userId, reason: input.reason, message: input.message });

  const [counted] = await db.select({ n: sql<number>`count(distinct ${scholarshipReports.userId})::int` }).from(scholarshipReports)
    .where(and(eq(scholarshipReports.scholarshipId, scholarshipId), isNull(scholarshipReports.resolvedAt), inArray(scholarshipReports.reason, [...SERIOUS])));
  if (row.status === "active" && (counted?.n ?? 0) >= AUTO_HIDE_REPORTS) {
    await db.update(scholarships).set({ status: "hidden", hiddenReason: "reported", updatedAt: sql`now()` }).where(eq(scholarships.id, scholarshipId));
  }
}

const listQuery = z.object({
  status: z.enum(["all", "active", "hidden"]).default("all"),
  verification: z.enum(["all", "verified", "unverified"]).default("all"),
  reported: z.enum(["0", "1"]).default("0"),
  search: z.string().trim().max(100).default(""),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

export async function adminListScholarships(db: Database, rawQuery: unknown) {
  const parsed = listQuery.safeParse(rawQuery ?? {});
  if (!parsed.success) throw new HttpError(400, "invalid_query", zodFields(parsed.error));
  const q = parsed.data;
  const openReports = db.select({ scholarshipId: scholarshipReports.scholarshipId, n: count().as("n") }).from(scholarshipReports)
    .where(isNull(scholarshipReports.resolvedAt)).groupBy(scholarshipReports.scholarshipId).as("open_reports");
  const like = `%${q.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const where = and(
    q.status === "all" ? undefined : eq(scholarships.status, q.status),
    q.verification === "all" ? undefined : eq(scholarships.verificationStatus, q.verification),
    q.reported === "1" ? sql`${openReports.n} > 0` : undefined,
    q.search ? or(ilike(scholarships.title, like), ilike(scholarships.institution, like), ilike(scholarships.id, like)) : undefined
  );
  const base = () => db.select({ row: scholarships, reports: sql<number>`coalesce(${openReports.n}, 0)::int` }).from(scholarships)
    .leftJoin(openReports, eq(openReports.scholarshipId, scholarships.id)).where(where);
  const [rows, totals] = await Promise.all([
    base().orderBy(desc(sql`coalesce(${openReports.n}, 0)`), asc(scholarships.deadline), asc(scholarships.id)).limit(q.pageSize).offset((q.page - 1) * q.pageSize),
    db.select({ n: count() }).from(scholarships).leftJoin(openReports, eq(openReports.scholarshipId, scholarships.id)).where(where)
  ]);
  return {
    total: totals[0]?.n ?? 0,
    items: rows.map(({ row, reports }) => ({ ...toScholarship(row), ...(row.hiddenReason ? { hiddenReason: row.hiddenReason } : {}), openReports: reports }))
  };
}

/** Cria ou substitui uma bolsa inteira (mesmo formato do importador). */
export async function adminPutScholarship(db: Database, id: string, body: unknown) {
  const parsed = scholarshipInput.safeParse(isRecord(body) ? { ...body, id } : body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "body";
      fields[key] ??= issue.message.length <= 40 && /^[a-z_]+$/.test(issue.message) ? issue.message : "invalid";
    }
    throw validationFailed(fields);
  }
  const [existing] = await db.select({ id: scholarships.id }).from(scholarships).where(eq(scholarships.id, id)).limit(1);
  await upsertScholarship(db, parsed.data, "manual");
  const [row] = await db.select().from(scholarships).where(eq(scholarships.id, id)).limit(1);
  return { created: !existing, scholarship: toScholarship(row!) };
}

const patchSchema = z.object({
  status: z.enum(["active", "hidden"]).optional(),
  verification: z.enum(["verified", "unverified"]).optional(),
  hiddenReason: z.string().trim().max(200).optional()
}).strict().refine((v) => v.status !== undefined || v.verification !== undefined, { message: "required", path: ["status"] });

/** Verificar/desverificar, ocultar/reativar. Verificar = alguém conferiu com o edital hoje. */
export async function adminPatchScholarship(db: Database, id: string, body: unknown) {
  const parsed = patchSchema.safeParse(body ?? {});
  if (!parsed.success) throw validationFailed(zodFields(parsed.error));
  const v = parsed.data;
  const today = new Date().toISOString().slice(0, 10);
  const set: Partial<typeof scholarships.$inferInsert> = { updatedAt: new Date() };
  if (v.status === "active") Object.assign(set, { status: "active", hiddenReason: null });
  if (v.status === "hidden") Object.assign(set, { status: "hidden", hiddenReason: v.hiddenReason || "admin" });
  if (v.verification === "verified") Object.assign(set, { verificationStatus: "verified", verifiedAt: today, lastCheckedAt: new Date() });
  if (v.verification === "unverified") Object.assign(set, { verificationStatus: "unverified", verifiedAt: null });
  const [row] = await db.update(scholarships).set(set).where(eq(scholarships.id, id)).returning();
  if (!row) throw notFound();
  return toScholarship(row);
}

export async function adminListReports(db: Database, scholarshipId: string) {
  const rows = await db.select({
    id: scholarshipReports.id, reason: scholarshipReports.reason, message: scholarshipReports.message,
    createdAt: scholarshipReports.createdAt, resolvedAt: scholarshipReports.resolvedAt, reporter: users.email
  }).from(scholarshipReports).leftJoin(users, eq(users.id, scholarshipReports.userId))
    .where(eq(scholarshipReports.scholarshipId, scholarshipId)).orderBy(desc(scholarshipReports.createdAt)).limit(100);
  return {
    items: rows.map((r) => ({
      id: r.id, reason: r.reason, message: r.message, createdAt: r.createdAt.toISOString(),
      ...(r.resolvedAt ? { resolvedAt: r.resolvedAt.toISOString() } : {}), ...(r.reporter ? { reporter: r.reporter } : {})
    }))
  };
}

/** Marca todos os relatos abertos de uma bolsa como resolvidos. */
export async function adminResolveReports(db: Database, scholarshipId: string) {
  const rows = await db.update(scholarshipReports).set({ resolvedAt: new Date() })
    .where(and(eq(scholarshipReports.scholarshipId, scholarshipId), isNull(scholarshipReports.resolvedAt))).returning({ id: scholarshipReports.id });
  return { resolved: rows.length };
}
