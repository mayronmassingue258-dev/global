import { HttpError, validationFailed } from "./errors.js";
import { profileSchema, zodFields, type StudentProfile } from "../matching/model.js";

/**
 * Validações do contrato. Os CÓDIGOS de erro de campo são parte do contrato com o frontend:
 * required, too_long, invalid_type, invalid_option, out_of_range, not_found.
 */

export const STUDY_LEVELS = ["Graduação", "Mestrado", "Doutorado", "Curso livre"] as const;
export const APPLICATION_STATUSES = ["Saved", "Preparing", "Ready to submit", "Submitted", "Decision received"] as const;
export const DOCUMENT_TYPES = ["motivation_letter", "academic_cv", "personal_statement", "document_review"] as const;
export const SORTS = ["deadline", "title"] as const;


export const NOTES_MAX = 5000;
export const DRAFT_LIMITS = { title: 120, program: 160, section: 20000, sections: 20 } as const;
const SECTION_KEY = /^[a-z][a-z0-9_]{0,39}$/;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export type DraftType = (typeof DOCUMENT_TYPES)[number];
export type ApplicationPatch = { status?: ApplicationStatus; notes?: string; documents?: { name: string; done: boolean }[] };
export type DraftInput = { type: DraftType; title: string; program: string; sections: Record<string, string> };
export type ListQuery = { search: string; country: string; level: string; sort: (typeof SORTS)[number]; page: number; pageSize: number };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function requireObject(body: unknown): Record<string, unknown> {
  if (!isRecord(body)) throw new HttpError(400, "invalid_body");
  return body;
}

export function parseListQuery(q: Record<string, unknown>): ListQuery {
  const str = (k: string) => (typeof q[k] === "string" ? (q[k] as string) : "");
  const sort = str("sort") || "deadline";
  const page = Number(str("page") || "1");
  const pageSize = Number(str("pageSize") || "10");
  const fields: Record<string, string> = {};
  if (!(SORTS as readonly string[]).includes(sort)) fields.sort = "invalid_option";
  if (!Number.isInteger(page) || page < 1) fields.page = "out_of_range";
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) fields.pageSize = "out_of_range";
  if (Object.keys(fields).length > 0) throw new HttpError(400, "invalid_query", fields);
  return { search: str("search").trim(), country: str("country").trim(), level: str("level"), sort: sort as ListQuery["sort"], page, pageSize };
}

export function parseProfile(body: unknown): StudentProfile {
  const parsed = profileSchema.safeParse(requireObject(body));
  if (!parsed.success) throw validationFailed(zodFields(parsed.error));
  return parsed.data;
}

export function parseApplicationCreate(body: unknown): string {
  const b = isRecord(body) ? body : {};
  if (typeof b.scholarshipId !== "string" || !b.scholarshipId) throw validationFailed({ scholarshipId: "required" });
  return b.scholarshipId;
}

export function parseApplicationPatch(body: unknown): ApplicationPatch {
  const b = requireObject(body);
  const fields: Record<string, string> = {};
  if (b.status !== undefined && !(APPLICATION_STATUSES as readonly unknown[]).includes(b.status)) fields.status = "invalid_option";
  if (b.notes !== undefined) {
    if (typeof b.notes !== "string") fields.notes = "invalid_type";
    else if (b.notes.length > NOTES_MAX) fields.notes = "too_long";
  }
  if (b.documents !== undefined) {
    const ok = Array.isArray(b.documents) && b.documents.every((d) => isRecord(d) && typeof d.name === "string" && typeof d.done === "boolean");
    if (!ok) fields.documents = "invalid_type";
  }
  if (b.status === undefined && b.notes === undefined && b.documents === undefined) fields.status = "required";
  if (Object.keys(fields).length > 0) throw validationFailed(fields);
  return b as ApplicationPatch;
}

export function parseDraft(body: unknown): DraftInput {
  const b = requireObject(body);
  const fields: Record<string, string> = {};
  const title = typeof b.title === "string" ? b.title.trim() : null;
  const program = typeof b.program === "string" ? b.program.trim() : b.program === undefined ? "" : null;
  if (!(DOCUMENT_TYPES as readonly unknown[]).includes(b.type)) fields.type = "invalid_option";
  if (title === null) fields.title = "invalid_type";
  else if (!title) fields.title = "required";
  else if (title.length > DRAFT_LIMITS.title) fields.title = "too_long";
  if (program === null) fields.program = "invalid_type";
  else if (program.length > DRAFT_LIMITS.program) fields.program = "too_long";
  const sections = b.sections ?? {};
  const entries = isRecord(sections) ? Object.entries(sections) : null;
  if (!entries || entries.length > DRAFT_LIMITS.sections || entries.some(([k, v]) => !SECTION_KEY.test(k) || typeof v !== "string")) fields.sections = "invalid_type";
  else if (entries.some(([, v]) => (v as string).length > DRAFT_LIMITS.section)) fields.sections = "too_long";
  if (Object.keys(fields).length > 0) throw validationFailed(fields);
  return { type: b.type as DraftType, title: title!, program: program!, sections: Object.fromEntries(entries!) as Record<string, string> };
}
