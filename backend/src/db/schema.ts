import { sql } from "drizzle-orm";
import type { ScholarshipMatch, StudentProfile } from "../matching/model.js";
import { bigserial, boolean, check, customType, date, foreignKey, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

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
  /** "student" (padrão) ou "admin" (painel de administração das bolsas). Promover: npm run admin:grant -- email. */
  role: text("role").notNull().default("student"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  uniqueIndex("users_email_lower_idx").on(sql`lower(${t.email})`),
  check("users_role_chk", sql`${t.role} in ('student','admin')`)
]);

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
  sourceUrl: text("source_url"),
  /** Critérios de compatibilidade (ver src/matching/model.ts → matchSchema). */
  match: jsonb("match").$type<ScholarshipMatch>().notNull(),
  /** "active" aparece para os estudantes; "hidden" não (prazo vencido, link quebrado, ocultada por um admin). */
  status: text("status").notNull().default("active"),
  hiddenReason: text("hidden_reason"),
  /** De onde veio: "manual" (importação/admin), "discovery" (busca automática), "demo" (fictícia). */
  origin: text("origin").notNull().default("manual"),
  /** Última vez que alguém (ou a verificação automática) conferiu o link e o prazo. */
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  verificationStatus: text("verification_status").notNull().default("unverified"),
  verifiedAt: date("verified_at", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  index("scholarships_deadline_idx").on(t.deadline),
  index("scholarships_level_idx").on(t.level),
  index("scholarships_status_idx").on(t.status),
  check("scholarships_verification_chk", sql`${t.verificationStatus} in ('verified','unverified')`),
  check("scholarships_status_chk", sql`${t.status} in ('active','hidden')`)
]);

export const profiles = pgTable("profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  /** Perfil estruturado (ver src/matching/model.ts → profileSchema). */
  data: jsonb("data").$type<Partial<StudentProfile>>().notNull().default({}),
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

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

/**
 * Arquivo anexado a um item do checklist (um por item; enviar de novo substitui).
 * Guardado no próprio PostgreSQL (até 10 MB): entra nos backups e some em cascata com a candidatura ou a conta.
 */
export const documentFiles = pgTable("document_files", {
  userId: uuid("user_id").notNull(),
  scholarshipId: text("scholarship_id").notNull(),
  documentName: text("document_name").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  content: bytea("content").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  primaryKey({ columns: [t.userId, t.scholarshipId, t.documentName] }),
  foreignKey({ name: "document_files_document_fk", columns: [t.userId, t.scholarshipId, t.documentName], foreignColumns: [applicationDocuments.userId, applicationDocuments.scholarshipId, applicationDocuments.name] }).onDelete("cascade")
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

/** Erros reportados por estudantes numa bolsa (link quebrado, prazo errado, …). Vistos no painel de administração. */
export const scholarshipReports = pgTable("scholarship_reports", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  scholarshipId: text("scholarship_id").notNull().references(() => scholarships.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  reason: text("reason").notNull(),
  message: text("message").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true })
}, (t) => [
  index("scholarship_reports_open_idx").on(t.scholarshipId).where(sql`${t.resolvedAt} is null`),
  check("scholarship_reports_reason_chk", sql`${t.reason} in ('broken_link','wrong_deadline','wrong_info','closed','scam','other')`)
]);

/** Execuções da busca automática de bolsas (disparadas pelo painel de administração). */
export const discoveryRuns = pgTable("discovery_runs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status").notNull().default("running"),
  dryRun: boolean("dry_run").notNull(),
  provider: text("provider").notNull(),
  sources: text("sources").array().notNull(),
  startedBy: uuid("started_by").references(() => users.id, { onDelete: "set null" }),
  /** Contagens e uso, no fim: { created, updated, skipped, requests, costUsd, problems: [...] }. */
  summary: jsonb("summary").$type<Record<string, unknown>>(),
  /** Registro linha a linha (o que foi encontrado, publicado ou ignorado, e por quê). */
  log: text("log").notNull().default("")
}, (t) => [
  index("discovery_runs_started_idx").on(t.startedAt),
  check("discovery_runs_status_chk", sql`${t.status} in ('running','done','failed')`)
]);
