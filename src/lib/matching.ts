/**
 * Vocabulário do perfil e dos critérios das bolsas (códigos estáveis; os rótulos PT/EN ficam nos dicionários).
 * CÓPIA de backend/src/matching/model.ts e countries.ts: um teste (matching.test.ts) garante que as listas batem.
 */
export const TARGET_LEVELS = ["bachelor", "master", "phd", "postdoc", "short_course"] as const;
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
export const GROUPS = ["women", "refugee", "disability", "first_generation", "low_income"] as const;
export const EXPERIENCE = ["research", "publications", "leadership", "volunteering", "teaching"] as const;

export type TargetLevel = (typeof TARGET_LEVELS)[number];
export type CompletedLevel = (typeof COMPLETED_LEVELS)[number];
export type FieldCode = (typeof FIELDS)[number];
export type LanguageCode = (typeof LANGUAGES)[number];
export type LanguageLevel = (typeof LANGUAGE_LEVELS)[number];
export type TestType = (typeof TESTS)[number];
export type GpaScale = (typeof GPA_SCALES)[number];
export type Coverage = (typeof COVERAGE)[number];
export type FundingNeed = (typeof FUNDING_NEEDS)[number];
export type StudyMode = (typeof STUDY_MODES)[number];
export type ScholarshipMode = (typeof SCHOLARSHIP_MODES)[number];
export type Group = (typeof GROUPS)[number];
export type Experience = (typeof EXPERIENCE)[number];

/** Nota máxima de cada teste (para validar no formulário). */
export const TEST_MAX: Record<TestType, number> = { ielts: 9, toefl_ibt: 120, duolingo: 160, pte: 90, gre: 340, gmat: 805 };

export const COUNTRY_CODES = [
  "AD", "AE", "AF", "AG", "AL", "AM", "AO", "AR", "AT", "AU", "AZ", "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ",
  "BN", "BO", "BR", "BS", "BT", "BW", "BY", "BZ", "CA", "CD", "CF", "CG", "CH", "CI", "CL", "CM", "CN", "CO", "CR", "CU",
  "CV", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE", "EG", "ER", "ES", "ET", "FI", "FJ", "FM", "FR", "GA",
  "GB", "GD", "GE", "GH", "GM", "GN", "GQ", "GR", "GT", "GW", "GY", "HK", "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IN",
  "IQ", "IR", "IS", "IT", "JM", "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KZ", "LA", "LB", "LC",
  "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MG", "MH", "MK", "ML", "MM", "MN", "MO", "MR",
  "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA", "NE", "NG", "NI", "NL", "NO", "NP", "NR", "NZ", "OM", "PA", "PE", "PG",
  "PH", "PK", "PL", "PS", "PT", "PW", "PY", "QA", "RO", "RS", "RU", "RW", "SA", "SB", "SC", "SD", "SE", "SG", "SI", "SK",
  "SL", "SM", "SN", "SO", "SR", "SS", "ST", "SV", "SY", "SZ", "TD", "TG", "TH", "TJ", "TL", "TM", "TN", "TO", "TR", "TT",
  "TV", "TW", "TZ", "UA", "UG", "US", "UY", "UZ", "VA", "VC", "VE", "VN", "VU", "WS", "XK", "YE", "ZA", "ZM", "ZW"
] as const;

export type CountryCode = (typeof COUNTRY_CODES)[number];

export const COUNTRY_GROUPS = {
  "@AFRICA": [
    "DZ", "AO", "BJ", "BW", "BF", "BI", "CV", "CM", "CF", "TD", "KM", "CG", "CD", "CI", "DJ", "EG", "GQ", "ER", "SZ", "ET",
    "GA", "GM", "GH", "GN", "GW", "KE", "LS", "LR", "LY", "MG", "MW", "ML", "MR", "MU", "MA", "MZ", "NA", "NE", "NG", "RW",
    "ST", "SN", "SC", "SL", "SO", "ZA", "SS", "SD", "TZ", "TG", "TN", "UG", "ZM", "ZW"
  ],
  "@CPLP": ["AO", "BR", "CV", "GW", "GQ", "MZ", "PT", "ST", "TL"],
  "@COMMONWEALTH": [
    "AG", "AU", "BS", "BD", "BB", "BZ", "BW", "BN", "CM", "CA", "CY", "DM", "SZ", "FJ", "GA", "GM", "GH", "GD", "GY", "IN",
    "JM", "KE", "KI", "LS", "MW", "MY", "MV", "MT", "MU", "MZ", "NA", "NR", "NZ", "NG", "PK", "PG", "RW", "KN", "LC", "VC",
    "WS", "SC", "SL", "SG", "SB", "ZA", "LK", "TO", "TT", "TV", "UG", "GB", "TZ", "VU", "ZM", "TG"
  ]
} as const satisfies Record<string, readonly CountryCode[]>;

export type CountryGroup = keyof typeof COUNTRY_GROUPS;

const displayNames = new Map<string, Intl.DisplayNames>();

/** Nome do país no idioma da interface ("MZ" → "Moçambique" / "Mozambique"). */
export function countryName(code: string, locale: string): string {
  let names = displayNames.get(locale);
  if (!names) {
    names = new Intl.DisplayNames([locale], { type: "region" });
    displayNames.set(locale, names);
  }
  try {
    return names.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Países ordenados pelo nome no idioma da interface (para listas de escolha). */
export function sortedCountries(locale: string): { code: CountryCode; name: string }[] {
  const collator = new Intl.Collator(locale);
  return COUNTRY_CODES.map((code) => ({ code, name: countryName(code, locale) })).sort((a, b) => collator.compare(a.name, b.name));
}
