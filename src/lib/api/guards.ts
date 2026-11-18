import type { AdminReport, AdminScholarship, Application, AttachedFile, Draft, EligibilityResult, Profile, Reason, Recommendations, Scholarship, ScholarshipPage, TimelineEvent } from "@/types";
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
    isRecord(v.verification) && (v.verification.status === "verified" || v.verification.status === "unverified") &&
    (v.match === undefined || isMatch(v.match)) &&
    (v.status === undefined || v.status === "active" || v.status === "hidden")
  );
}

/** Critérios: confere a forma (listas e tipos); valores desconhecidos são exibidos como vieram. */
function isMatch(v: unknown): boolean {
  return (
    isRecord(v) && isStrArray(v.levels) && isStrArray(v.fields) && isStrArray(v.eligibleNationalities) && isStrArray(v.destinations) &&
    isStrArray(v.coverage) && Array.isArray(v.languages) && Array.isArray(v.tests) && isStrArray(v.restrictedTo) &&
    typeof v.applicationFee === "boolean" && isStr(v.studyMode)
  );
}

const REASON_KINDS = new Set(["met", "gap", "missing", "failed", "info"]);
const isReason = (r: unknown): r is Reason => isRecord(r) && isStr(r.code) && isStr(r.kind) && REASON_KINDS.has(r.kind) && (r.params === undefined || isRecord(r.params));
const isFit = (v: unknown) => v === "high" || v === "medium" || v === "low";

export function isScholarshipPage(v: unknown): v is ScholarshipPage {
  return isRecord(v) && typeof v.total === "number" && Array.isArray(v.items) && v.items.every(isScholarship);
}

export function isEligibilityResult(v: unknown): v is EligibilityResult {
  return (
    isRecord(v) &&
    isStr(v.scholarshipId) &&
    (v.status === "eligible" || v.status === "possible" || v.status === "not_eligible") &&
    typeof v.score === "number" && isFit(v.fit) &&
    Array.isArray(v.reasons) && v.reasons.every(isReason)
  );
}

export function isRecommendations(v: unknown): v is Recommendations {
  return (
    isRecord(v) && typeof v.considered === "number" && typeof v.excluded === "number" && Array.isArray(v.items) &&
    v.items.every((i) => isRecord(i) && isScholarship(i.scholarship) && (i.eligibility === "eligible" || i.eligibility === "possible") &&
      typeof i.score === "number" && isFit(i.fit) && Array.isArray(i.reasons) && i.reasons.every(isReason) && typeof i.saved === "boolean")
  );
}

export function isAdminPage(v: unknown): v is { items: AdminScholarship[]; total: number } {
  return isRecord(v) && typeof v.total === "number" && Array.isArray(v.items) && v.items.every((i) => isScholarship(i) && typeof (i as Record<string, unknown>).openReports === "number");
}

export function isAdminReports(v: unknown): v is { items: AdminReport[] } {
  return isRecord(v) && Array.isArray(v.items) && v.items.every((r) => isRecord(r) && typeof r.id === "number" && isStr(r.reason) && isStr(r.message) && isStr(r.createdAt));
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

const isNumOrNull = (v: unknown) => v === null || typeof v === "number";

export function isProfile(v: unknown): v is Profile {
  return (
    isRecord(v) &&
    isStrArray(v.nationalities) && isStr(v.residenceCountry) && isStr(v.completedLevel) && isStrArray(v.targetLevels) &&
    isStrArray(v.fields) && isStr(v.fieldDetail) && (v.gpa === null || (isRecord(v.gpa) && typeof v.gpa.value === "number" && isStr(v.gpa.scale))) &&
    isNumOrNull(v.graduationYear) && Array.isArray(v.languages) && Array.isArray(v.tests) && isNumOrNull(v.workYears) &&
    isStrArray(v.experience) && isNumOrNull(v.birthYear) && isStrArray(v.groups) && isStr(v.fundingNeed) && isStrArray(v.needsCoverage) &&
    (v.canPayApplicationFee === null || typeof v.canPayApplicationFee === "boolean") && isStrArray(v.destinations) &&
    isStrArray(v.excludedDestinations) && isStr(v.studyMode) && isNumOrNull(v.startYear) && isStr(v.goals) &&
    isRecord(v.completeness) && typeof v.completeness.percent === "number" && isStrArray(v.completeness.missing) &&
    (v.updatedAt === undefined || isStr(v.updatedAt))
  );
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
