import type { DocumentType, DraftInput } from "@/types";

export const DOCUMENT_TYPES: DocumentType[] = ["motivation_letter", "academic_cv", "personal_statement", "document_review"];
export const DRAFT_LIMITS = { title: 120, program: 160, section: 20000, sections: 20 } as const;
const SECTION_KEY = /^[a-z][a-z0-9_]{0,39}$/;

export type DraftErrors = Partial<Record<"type" | "title" | "program" | "sections", "required" | "too_long" | "invalid_option" | "invalid_type">>;

/** Mesmas regras do servidor local. O servidor valida de novo. */
export function validateDraft(input: DraftInput): DraftErrors {
  const errors: DraftErrors = {};
  if (!DOCUMENT_TYPES.includes(input.type)) errors.type = "invalid_option";
  if (!input.title.trim()) errors.title = "required";
  else if (input.title.trim().length > DRAFT_LIMITS.title) errors.title = "too_long";
  if (input.program.trim().length > DRAFT_LIMITS.program) errors.program = "too_long";
  const entries = Object.entries(input.sections);
  if (entries.length > DRAFT_LIMITS.sections || entries.some(([k, v]) => !SECTION_KEY.test(k) || typeof v !== "string")) errors.sections = "invalid_type";
  else if (entries.some(([, v]) => v.length > DRAFT_LIMITS.section)) errors.sections = "too_long";
  return errors;
}
