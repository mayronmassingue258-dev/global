import { and, asc, count, eq, gte, ilike, or, sql } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { applications, scholarships } from "../db/schema.js";
import { matchScholarship } from "../matching/engine.js";
import { matchSchema } from "../matching/model.js";
import type { ListQuery } from "../lib/validation.js";
import { loadProfile } from "./profile.js";

type Row = typeof scholarships.$inferSelect;

/** Critérios guardados, lidos de forma tolerante (valores antigos inválidos viram o padrão). */
export function readMatch(r: Row) {
  const parsed = matchSchema.safeParse(r.match);
  return parsed.success ? parsed.data : matchSchema.parse({ levels: ["bachelor", "master", "phd"] });
}

const today = () => new Date().toISOString().slice(0, 10);

/** Converte a linha da base no objeto `Scholarship` do contrato (só campos públicos, opcionais omitidos quando vazios). */
export function toScholarship(r: Row) {
  return {
    id: r.id,
    title: r.title,
    institution: r.institution,
    country: r.country,
    level: r.level,
    fundingType: r.fundingType,
    funding: r.funding,
    deadline: r.deadline,
    ...(r.deadlineTimezone ? { deadlineTimezone: r.deadlineTimezone } : {}),
    summary: r.summary,
    requirements: r.requirements,
    requiredDocuments: r.requiredDocuments,
    ...(r.applicationProcess ? { applicationProcess: r.applicationProcess } : {}),
    ...(r.sourceUrl ? { sourceUrl: r.sourceUrl } : {}),
    match: readMatch(r),
    status: r.status as "active" | "hidden",
    origin: r.origin as "manual" | "discovery" | "demo",
    ...(r.lastCheckedAt ? { lastCheckedAt: r.lastCheckedAt.toISOString() } : {}),
    verification: { status: r.verificationStatus as "verified" | "unverified", ...(r.verifiedAt ? { verifiedAt: r.verifiedAt } : {}) }
  };
}

/** Escapa % e _ para a busca por texto não virar curinga. */
const like = (value: string) => `%${value.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export async function listScholarships(db: Database, q: ListQuery) {
  const filters = [
    eq(scholarships.status, "active"),
    q.search ? or(ilike(scholarships.title, like(q.search)), ilike(scholarships.institution, like(q.search)), ilike(scholarships.country, like(q.search))) : undefined,
    q.country ? ilike(scholarships.country, like(q.country)) : undefined,
    q.level ? eq(scholarships.level, q.level) : undefined
  ].filter(Boolean);
  const where = and(...filters);
  // Ordenação estável: empate decidido pelo id (paginação sem itens repetidos ou pulados).
  const order = q.sort === "title" ? [sql`${scholarships.title} collate "und-x-icu"`, asc(scholarships.id)] : [asc(scholarships.deadline), asc(scholarships.id)];
  const [rows, totals] = await Promise.all([
    db.select().from(scholarships).where(where).orderBy(...order).limit(q.pageSize).offset((q.page - 1) * q.pageSize),
    db.select({ n: count() }).from(scholarships).where(where)
  ]);
  return { items: rows.map(toScholarship), total: totals[0]?.n ?? 0 };
}

export async function getScholarshipRow(db: Database, id: string) {
  const [row] = await db.select().from(scholarships).where(eq(scholarships.id, id)).limit(1);
  return row ?? null;
}

export async function getEligibility(db: Database, userId: string, id: string) {
  const row = await getScholarshipRow(db, id);
  if (!row) return null;
  const profile = await loadProfile(db, userId);
  const result = matchScholarship(profile, { deadline: row.deadline, match: readMatch(row) });
  return { scholarshipId: id, status: result.eligibility, score: result.score, fit: result.fit, reasons: result.reasons };
}

/**
 * Recomendações: todas as bolsas ativas com prazo aberto passam pelo motor; ficam as que não são eliminadas,
 * da maior nota para a menor (empate: prazo mais próximo). A base de bolsas é pequena (centenas a poucos milhares):
 * calcular em memória é rápido e mantém o motor simples e testável.
 */
export async function getRecommendations(db: Database, userId: string, limit: number) {
  const [profile, rows, saved] = await Promise.all([
    loadProfile(db, userId),
    db.select().from(scholarships).where(and(eq(scholarships.status, "active"), gte(scholarships.deadline, today()))),
    db.select({ id: applications.scholarshipId }).from(applications).where(eq(applications.userId, userId))
  ]);
  const savedIds = new Set(saved.map((s) => s.id));
  const now = new Date();
  const scored = rows.map((row) => ({ row, result: matchScholarship(profile, { deadline: row.deadline, match: readMatch(row) }, now) }));
  const candidates = scored.filter((s) => s.result.eligibility !== "not_eligible");
  candidates.sort((a, b) => b.result.score - a.result.score || a.row.deadline.localeCompare(b.row.deadline) || a.row.id.localeCompare(b.row.id));
  return {
    considered: rows.length,
    excluded: scored.length - candidates.length,
    items: candidates.slice(0, limit).map(({ row, result }) => ({
      scholarship: toScholarship(row),
      eligibility: result.eligibility,
      score: result.score,
      fit: result.fit,
      reasons: result.reasons,
      saved: savedIds.has(row.id)
    }))
  };
}

/** Oculta bolsas com prazo vencido (roda na partida e periodicamente). Devolve quantas foram ocultadas. */
export async function hideExpired(db: Database) {
  const rows = await db.update(scholarships)
    .set({ status: "hidden", hiddenReason: "deadline_passed", updatedAt: sql`now()` })
    .where(and(eq(scholarships.status, "active"), sql`${scholarships.deadline} < current_date`))
    .returning({ id: scholarships.id });
  return rows.length;
}
