import { z } from "zod";
import { isCountryCode, isCountryOrGroup } from "./countries.js";

/**
 * Vocabulário comum do PERFIL do estudante e dos CRITÉRIOS das bolsas. Tudo em códigos estáveis
 * (o frontend traduz para PT/EN): a comparação nunca depende de grafia ("Moçambique" vs "Mozambique").
 * Mudou algo aqui? Atualize src/types (frontend), docs/api-contract.md e backend/src/openapi.ts.
 */

/** Nível que a bolsa financia / que o estudante quer cursar. */
export const TARGET_LEVELS = ["bachelor", "master", "phd", "postdoc", "short_course"] as const;
/** Maior nível já concluído. */
export const COMPLETED_LEVELS = ["secondary", "bachelor", "master", "phd"] as const;
export const FIELDS = [
  "agriculture", "architecture", "arts_humanities", "business_economics", "computer_science", "education",
  "engineering", "environment_energy", "health_medicine", "public_health", "law", "mathematics_statistics",
  "natural_sciences", "social_sciences", "public_policy", "communication_media", "tourism_hospitality", "any_other"
] as const;
export const LANGUAGES = ["pt", "en", "fr", "es", "de", "it", "nl", "zh", "ja", "ko", "ru", "ar", "tr", "sv"] as const;
export const LANGUAGE_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2", "native"] as const;
export const TESTS = ["ielts", "toefl_ibt", "duolingo", "pte", "gre", "gmat"] as const;
export const GPA_SCALES = ["4", "5", "10", "20", "100"] as const;
export const COVERAGE = ["tuition", "living", "travel", "accommodation", "insurance"] as const;
export const FUNDING_NEEDS = ["full", "partial", "none"] as const;
export const STUDY_MODES = ["onsite", "online", "any"] as const;
export const SCHOLARSHIP_MODES = ["onsite", "online", "hybrid"] as const;
/** Grupos de bolsas com público restrito. Autodeclarado, opcional e nunca exibido a terceiros. */
export const GROUPS = ["women", "refugee", "disability", "first_generation", "low_income"] as const;
export const EXPERIENCE = ["research", "publications", "leadership", "volunteering", "teaching"] as const;

export type TargetLevel = (typeof TARGET_LEVELS)[number];
export type CompletedLevel = (typeof COMPLETED_LEVELS)[number];
export type Coverage = (typeof COVERAGE)[number];
export type LanguageLevel = (typeof LANGUAGE_LEVELS)[number];

const TEST_MAX: Record<(typeof TESTS)[number], number> = { ielts: 9, toefl_ibt: 120, duolingo: 160, pte: 90, gre: 340, gmat: 805 };
const thisYear = () => new Date().getUTCFullYear();

const country = z.string().refine(isCountryCode, "invalid_option");
const uniq = <T>(arr: T[]) => new Set(arr).size === arr.length;
const set = <T extends z.ZodTypeAny>(item: T, max: number) => z.array(item).max(max, "too_long").refine(uniq, "duplicate");

const test = z.object({ type: z.enum(TESTS), score: z.number().nonnegative() })
  .refine((t) => t.score <= TEST_MAX[t.type], { message: "out_of_range", path: ["score"] });

/** Perfil do estudante. Tudo opcional: o formulário salva por etapas e a completude é calculada. */
export const profileSchema = z.object({
  nationalities: set(country, 3).default([]),
  residenceCountry: country.or(z.literal("")).default(""),
  completedLevel: z.enum(COMPLETED_LEVELS).or(z.literal("")).default(""),
  targetLevels: set(z.enum(TARGET_LEVELS), 5).default([]),
  fields: set(z.enum(FIELDS), 3).default([]),
  fieldDetail: z.string().trim().max(120, "too_long").default(""),
  gpa: z.object({ value: z.number().nonnegative(), scale: z.enum(GPA_SCALES) })
    .refine((g) => g.value <= Number(g.scale), { message: "out_of_range", path: ["value"] }).nullable().default(null),
  graduationYear: z.number().int().min(1960).max(thisYear() + 8).nullable().default(null),
  languages: z.array(z.object({ code: z.enum(LANGUAGES), level: z.enum(LANGUAGE_LEVELS) })).max(8, "too_long")
    .refine((l) => uniq(l.map((x) => x.code)), "duplicate").default([]),
  tests: z.array(test).max(6, "too_long").refine((l) => uniq(l.map((x) => x.type)), "duplicate").default([]),
  workYears: z.number().int().min(0).max(60).nullable().default(null),
  experience: set(z.enum(EXPERIENCE), EXPERIENCE.length).default([]),
  birthYear: z.number().int().min(1940).max(thisYear() - 12).nullable().default(null),
  groups: set(z.enum(GROUPS), GROUPS.length).default([]),
  fundingNeed: z.enum(FUNDING_NEEDS).or(z.literal("")).default(""),
  needsCoverage: set(z.enum(COVERAGE), COVERAGE.length).default([]),
  canPayApplicationFee: z.boolean().nullable().default(null),
  destinations: set(country, 10).default([]),
  excludedDestinations: set(country, 20).default([]),
  studyMode: z.enum(STUDY_MODES).or(z.literal("")).default(""),
  startYear: z.number().int().min(thisYear()).max(thisYear() + 6).nullable().default(null),
  goals: z.string().trim().max(1000, "too_long").default("")
}).strict();

export type StudentProfile = z.infer<typeof profileSchema>;
export const emptyProfile = (): StudentProfile => profileSchema.parse({});

/** Critérios de compatibilidade de uma bolsa (públicos: aparecem na página da bolsa). */
export const matchSchema = z.object({
  /** Níveis que a bolsa financia. */
  levels: set(z.enum(TARGET_LEVELS), 5).min(1, "required"),
  /** Áreas aceitas. Vazio = qualquer área. */
  fields: set(z.enum(FIELDS), FIELDS.length).default([]),
  /** Nacionalidades elegíveis: códigos ISO ou grupos (@AFRICA, @CPLP, @COMMONWEALTH). Vazio = qualquer. */
  eligibleNationalities: set(z.string().refine(isCountryOrGroup, "invalid_option"), 250).default([]),
  /** Países onde se estuda. Vazio = vários/online. */
  destinations: set(country, 30).default([]),
  coverage: set(z.enum(COVERAGE), COVERAGE.length).default([]),
  /** Idiomas exigidos (todos). */
  languages: z.array(z.object({ code: z.enum(LANGUAGES), minLevel: z.enum(LANGUAGE_LEVELS) })).max(4).default([]),
  /** Testes aceitos (basta um). */
  tests: z.array(z.object({ type: z.enum(TESTS), minScore: z.number().nonnegative() })).max(6).default([]),
  /** Nota mínima em % (0–100) após conversão da escala. */
  minGpaPercent: z.number().min(0).max(100).nullable().default(null),
  /** Nível que precisa estar concluído. Nulo = deduzido do nível financiado. */
  requiredCompletedLevel: z.enum(COMPLETED_LEVELS).nullable().default(null),
  maxAge: z.number().int().min(15).max(80).nullable().default(null),
  minWorkYears: z.number().int().min(0).max(30).nullable().default(null),
  /** Público restrito (basta pertencer a um). Vazio = aberto a todos. */
  restrictedTo: set(z.enum(GROUPS), GROUPS.length).default([]),
  applicationFee: z.boolean().default(false),
  studyMode: z.enum(SCHOLARSHIP_MODES).default("onsite")
}).strict();

export type ScholarshipMatch = z.infer<typeof matchSchema>;

/** Converte z.ZodError em { campo: código } (contrato de erros de validação). */
export function zodFields(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? String(issue.path[0])
      : issue.code === "unrecognized_keys" ? String(issue.keys[0]) : "body";
    if (fields[key]) continue;
    const msg = issue.message;
    fields[key] = ["too_long", "duplicate", "out_of_range", "invalid_option", "required"].includes(msg)
      ? msg
      : issue.code === "invalid_value" || issue.code === "invalid_union" ? "invalid_option"
      : issue.code === "unrecognized_keys" ? "unknown_field"
      : issue.code === "too_big" || issue.code === "too_small" ? "out_of_range"
      : "invalid_type";
  }
  return fields;
}

/**
 * Lê um perfil GUARDADO de forma tolerante: campo inválido (ex.: ano de início que já passou, opção removida)
 * vira o valor padrão em vez de derrubar a leitura inteira.
 */
export function sanitizeProfile(raw: unknown): StudentProfile {
  const source = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const out = emptyProfile() as Record<string, unknown>;
  for (const [key, schema] of Object.entries(profileSchema.shape)) {
    if (!(key in source)) continue;
    const parsed = (schema as z.ZodTypeAny).safeParse(source[key]);
    if (parsed.success) out[key] = parsed.data;
  }
  return out as StudentProfile;
}
