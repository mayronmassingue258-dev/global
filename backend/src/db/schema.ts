import { sql } from "drizzle-orm";
import { bigserial, boolean, check, date, foreignKey, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * Esquema da base de dados. Toda informação do estudante tem `user_id`: na B1 existe só o estudante de
 * demonstração; na B2 (contas) cada pessoa passa a ver apenas os seus dados.
 * Mudou algo aqui? Rode `npm run db:generate` para criar a migração SQL correspondente e versione-a.
 */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  name: text("name").notNull().default(""),
  /** Preenchido na B2. Nulo = conta sem senha (ex.: estudante de demonstração). */
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [uniqueIndex("users_email_lower_idx").on(sql`lower(${t.email})`)]);

/**
 * Sessões de login. O cookie leva um token aleatório; aqui fica só o HASH (sha256) dele:
 * quem ler a base não consegue se passar pelo estudante.
 */
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  userAgent: text("user_agent").notNull().default("")
}, (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)]);

/** Pedidos de redefinição de senha: só o hash do token, válido por 1 hora, uso único. */
export const passwordResets = pgTable("password_resets", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [index("password_resets_user_idx").on(t.userId)]);

export const scholarships = pgTable("scholarships", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  institution: text("institution").notNull(),
  country: text("country").notNull(),
  level: text("level").notNull(),
  fundingType: text("funding_type").notNull(),
  funding: text("funding").notNull(),
  deadline: date("deadline", { mode: "string" }).notNull(),
  deadlineTimezone: text("deadline_timezone"),
  summary: text("summary").notNull(),
  requirements: text("requirements").array().notNull().default(sql`'{}'::text[]`),
  requiredDocuments: text("required_documents").array().notNull().default(sql`'{}'::text[]`),
  applicationProcess: text("application_process"),
  eligibleCountries: text("eligible_countries").array(),
  sourceUrl: text("source_url"),
  verificationStatus: text("verification_status").notNull().default("unverified"),
  verifiedAt: date("verified_at", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  index("scholarships_deadline_idx").on(t.deadline),
  index("scholarships_level_idx").on(t.level),
  check("scholarships_verification_chk", sql`${t.verificationStatus} in ('verified','unverified')`)
]);

/** Critérios usados pelo motor de elegibilidade (não fazem parte da resposta pública da bolsa). */
export const eligibilityCriteria = pgTable("eligibility_criteria", {
  scholarshipId: text("scholarship_id").primaryKey().references(() => scholarships.id, { onDelete: "cascade" }),
  acceptedLevels: text("accepted_levels").array().notNull().default(sql`'{}'::text[]`),
  needs: text("needs").array().notNull().default(sql`'{}'::text[]`)
});

export const profiles = pgTable("profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  residence: text("residence").notNull().default(""),
  nationality: text("nationality").notNull().default(""),
  level: text("level").notNull().default(""),
  field: text("field").notNull().default(""),
  grade: text("grade").notNull().default(""),
  languages: text("languages").notNull().default(""),
  interests: text("interests").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true })
});

export const applications = pgTable("applications", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scholarshipId: text("scholarship_id").notNull().references(() => scholarships.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("Saved"),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  primaryKey({ columns: [t.userId, t.scholarshipId] }),
  check("applications_status_chk", sql`${t.status} in ('Saved','Preparing','Ready to submit','Submitted','Decision received')`)
]);

export const applicationDocuments = pgTable("application_documents", {
  userId: uuid("user_id").notNull(),
  scholarshipId: text("scholarship_id").notNull(),
  name: text("name").notNull(),
  position: integer("position").notNull(),
  done: boolean("done").notNull().default(false)
}, (t) => [
  primaryKey({ columns: [t.userId, t.scholarshipId, t.name] }),
  foreignKey({ columns: [t.userId, t.scholarshipId], foreignColumns: [applications.userId, applications.scholarshipId] }).onDelete("cascade")
]);

/** Linha do tempo. Ordem = id crescente. */
export const applicationEvents = pgTable("application_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: uuid("user_id").notNull(),
  scholarshipId: text("scholarship_id").notNull(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  kind: text("kind").notNull(),
  status: text("status"),
  document: text("document"),
  done: boolean("done")
}, (t) => [
  index("application_events_app_idx").on(t.userId, t.scholarshipId, t.id),
  foreignKey({ columns: [t.userId, t.scholarshipId], foreignColumns: [applications.userId, applications.scholarshipId] }).onDelete("cascade"),
  check("application_events_kind_chk", sql`${t.kind} in ('created','status','document','notes')`)
]);

export const drafts = pgTable("drafts", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  program: text("program").notNull().default(""),
  sections: jsonb("sections").$type<Record<string, string>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  index("drafts_user_updated_idx").on(t.userId, t.updatedAt),
  check("drafts_type_chk", sql`${t.type} in ('motivation_letter','academic_cv','personal_statement','document_review')`)
]);
