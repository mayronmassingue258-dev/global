import { and, asc, count, eq, ilike, or, sql } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { eligibilityCriteria, profiles, scholarships } from "../db/schema.js";
import { evaluateEligibility } from "../eligibility/evaluate.js";
import { PROFILE_FIELDS, type ListQuery } from "../lib/validation.js";

type Row = typeof scholarships.$inferSelect;

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
    ...(r.eligibleCountries && r.eligibleCountries.length > 0 ? { eligibleCountries: r.eligibleCountries } : {}),
    ...(r.sourceUrl ? { sourceUrl: r.sourceUrl } : {}),
    verification: { status: r.verificationStatus as "verified" | "unverified", ...(r.verifiedAt ? { verifiedAt: r.verifiedAt } : {}) }
  };
}

/** Escapa % e _ para a busca por texto não virar curinga. */
const like = (value: string) => `%${value.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export async function listScholarships(db: Database, q: ListQuery) {
  const filters = [
    q.search ? or(ilike(scholarships.title, like(q.search)), ilike(scholarships.institution, like(q.search)), ilike(scholarships.country, like(q.search))) : undefined,
    q.country ? ilike(scholarships.country, like(q.country)) : undefined,
    q.level ? eq(scholarships.level, q.level) : undefined
  ].filter(Boolean);
  const where = filters.length > 0 ? and(...filters) : undefined;
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
  const [[criteria], [profile]] = await Promise.all([
    db.select().from(eligibilityCriteria).where(eq(eligibilityCriteria.scholarshipId, id)).limit(1),
    db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1)
  ]);
  const fields: Record<string, string> = profile ? Object.fromEntries(PROFILE_FIELDS.map((k) => [k, profile[k]])) : {};
  return evaluateEligibility(row, criteria ?? null, fields);
}
