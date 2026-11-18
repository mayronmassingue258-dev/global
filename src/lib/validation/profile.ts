import { TEST_MAX } from "@/lib/matching";
import type { Profile, ProfileInput } from "@/types";

export type ProfileField = keyof ProfileInput;
/** Códigos de erro de campo. Os mesmos códigos são devolvidos pela API em `error.fields` (422). */
export type ProfileErrorCode = "required" | "too_long" | "out_of_range" | "duplicate" | "invalid_option" | "invalid_type";
export type ProfileErrors = Partial<Record<ProfileField, ProfileErrorCode>>;

export const PROFILE_LIMITS = { nationalities: 3, fields: 3, languages: 8, tests: 6, destinations: 10, excludedDestinations: 20, fieldDetail: 120, goals: 1000 } as const;

export const emptyProfile: ProfileInput = {
  nationalities: [], residenceCountry: "", completedLevel: "", targetLevels: [], fields: [], fieldDetail: "", gpa: null,
  graduationYear: null, languages: [], tests: [], workYears: null, experience: [], birthYear: null, groups: [],
  fundingNeed: "", needsCoverage: [], canPayApplicationFee: null, destinations: [], excludedDestinations: [], studyMode: "",
  startYear: null, goals: ""
};

const thisYear = () => new Date().getFullYear();
const outside = (v: number | null, min: number, max: number) => v !== null && (!Number.isInteger(v) || v < min || v > max);

/** Validação do lado do cliente (mesmas regras do servidor). O servidor valida de novo. */
export function validateProfile(p: ProfileInput): ProfileErrors {
  const e: ProfileErrors = {};
  const year = thisYear();
  if (p.nationalities.length > PROFILE_LIMITS.nationalities) e.nationalities = "too_long";
  if (p.fields.length > PROFILE_LIMITS.fields) e.fields = "too_long";
  if (p.fieldDetail.trim().length > PROFILE_LIMITS.fieldDetail) e.fieldDetail = "too_long";
  if (p.goals.trim().length > PROFILE_LIMITS.goals) e.goals = "too_long";
  if (p.gpa && (!Number.isFinite(p.gpa.value) || p.gpa.value < 0 || p.gpa.value > Number(p.gpa.scale))) e.gpa = "out_of_range";
  if (outside(p.graduationYear, 1960, year + 8)) e.graduationYear = "out_of_range";
  if (outside(p.birthYear, 1940, year - 12)) e.birthYear = "out_of_range";
  if (outside(p.workYears, 0, 60)) e.workYears = "out_of_range";
  if (outside(p.startYear, year, year + 6)) e.startYear = "out_of_range";
  if (new Set(p.languages.map((l) => l.code)).size !== p.languages.length) e.languages = "duplicate";
  if (new Set(p.tests.map((x) => x.type)).size !== p.tests.length) e.tests = "duplicate";
  else if (p.tests.some((x) => !Number.isFinite(x.score) || x.score < 0 || x.score > TEST_MAX[x.type])) e.tests = "out_of_range";
  if (p.destinations.length > PROFILE_LIMITS.destinations) e.destinations = "too_long";
  return e;
}

/** Itens que mais pesam nas recomendações (mesma lista do servidor), para o modo de demonstração. */
const COMPLETENESS: [string, (p: ProfileInput) => boolean][] = [
  ["nationalities", (p) => p.nationalities.length > 0], ["residenceCountry", (p) => p.residenceCountry !== ""],
  ["completedLevel", (p) => p.completedLevel !== ""], ["targetLevels", (p) => p.targetLevels.length > 0],
  ["fields", (p) => p.fields.length > 0], ["gpa", (p) => p.gpa !== null], ["languages", (p) => p.languages.length > 0],
  ["fundingNeed", (p) => p.fundingNeed !== ""], ["birthYear", (p) => p.birthYear !== null], ["workYears", (p) => p.workYears !== null],
  ["studyMode", (p) => p.studyMode !== ""], ["startYear", (p) => p.startYear !== null]
];

export function completenessOf(p: ProfileInput): Profile["completeness"] {
  const missing = COMPLETENESS.filter(([, filled]) => !filled(p)).map(([key]) => key);
  return { percent: Math.round(((COMPLETENESS.length - missing.length) / COMPLETENESS.length) * 100), missing };
}

/** Separa os campos do perfil dos metadados do servidor. */
export function toInput(profile: Profile | ProfileInput): ProfileInput {
  const out = { ...emptyProfile };
  for (const key of Object.keys(emptyProfile) as ProfileField[]) (out as Record<string, unknown>)[key] = profile[key];
  return out;
}
