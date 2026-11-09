import type { Application, AttachedFile, Draft, EligibilityResult, Profile, Scholarship, ScholarshipPage, TimelineEvent } from "@/types";
import { APPLICATION_STATUSES } from "@/lib/constants";
import { DOCUMENT_TYPES } from "@/lib/validation/draft";

// Validação em tempo de execução nas fronteiras da API (tipos TypeScript não validam dados de rede).
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isStr = (v: unknown): v is string => typeof v === "string";
const isStrArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);

export function isScholarship(v: unknown): v is Scholarship {
  return (
    isRecord(v) &&
    isStr(v.id) && isStr(v.title) && isStr(v.institution) && isStr(v.country) &&
    isStr(v.level) && isStr(v.fundingType) && isStr(v.funding) && isStr(v.deadline) &&
    isStr(v.summary) && isStrArray(v.requirements) && isStrArray(v.requiredDocuments) &&
    isRecord(v.verification) && (v.verification.status === "verified" || v.verification.status === "unverified")
  );
}

export function isScholarshipPage(v: unknown): v is ScholarshipPage {
  return isRecord(v) && typeof v.total === "number" && Array.isArray(v.items) && v.items.every(isScholarship);
}

export function isEligibilityResult(v: unknown): v is EligibilityResult {
  return (
    isRecord(v) &&
    isStr(v.scholarshipId) &&
    (v.status === "eligible" || v.status === "possible" || v.status === "not_eligible") &&
    Array.isArray(v.reasons) &&
    v.reasons.every((r) => isRecord(r) && isStr(r.text) && (r.kind === "met" || r.kind === "missing" || r.kind === "failed"))
  );
}

const STATUS_VALUES = new Set<string>(APPLICATION_STATUSES.map((s) => s.value));

function isTimelineEvent(v: unknown): v is TimelineEvent {
  if (!isRecord(v) || !isStr(v.at)) return false;
  switch (v.kind) {
    case "created":
    case "notes":
      return true;
    case "status":
      return isStr(v.status) && STATUS_VALUES.has(v.status);
    case "document":
      return isStr(v.document) && typeof v.done === "boolean";
    default:
      return false;
  }
}

export function isAttachedFile(v: unknown): v is AttachedFile {
  return isRecord(v) && isStr(v.name) && typeof v.size === "number" && isStr(v.type) && isStr(v.uploadedAt);
}

export function isApplication(v: unknown): v is Application {
  return (
    isRecord(v) &&
    isStr(v.id) &&
    isStr(v.updatedAt) &&
    isStr(v.status) && STATUS_VALUES.has(v.status) &&
    isRecord(v.scholarship) &&
    isStr(v.scholarship.id) && isStr(v.scholarship.title) && isStr(v.scholarship.institution) && isStr(v.scholarship.deadline) &&
    isStr(v.notes) &&
    Array.isArray(v.documents) && v.documents.every((d) => isRecord(d) && isStr(d.name) && typeof d.done === "boolean" && (d.file === undefined || isAttachedFile(d.file))) &&
    Array.isArray(v.timeline) && v.timeline.every(isTimelineEvent)
  );
}

export function isApplicationList(v: unknown): v is { items: Application[] } {
  return isRecord(v) && Array.isArray(v.items) && v.items.every(isApplication);
}

const PROFILE_KEYS = ["residence", "nationality", "level", "field", "grade", "languages", "interests"] as const;

export function isProfile(v: unknown): v is Profile {
  return isRecord(v) && PROFILE_KEYS.every((k) => isStr(v[k])) && (v.updatedAt === undefined || isStr(v.updatedAt));
}

const DOC_TYPES = new Set<string>(DOCUMENT_TYPES);

export function isDraft(v: unknown): v is Draft {
  return (
    isRecord(v) &&
    isStr(v.id) && isStr(v.title) && isStr(v.program) && isStr(v.createdAt) && isStr(v.updatedAt) &&
    isStr(v.type) && DOC_TYPES.has(v.type) &&
    isRecord(v.sections) && Object.values(v.sections).every(isStr)
  );
}

export function isDraftList(v: unknown): v is { items: Draft[] } {
  return isRecord(v) && Array.isArray(v.items) && v.items.every(isDraft);
}
