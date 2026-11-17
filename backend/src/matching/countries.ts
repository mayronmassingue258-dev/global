/**
 * Países (ISO 3166-1 alfa-2) e grupos usados nos critérios das bolsas.
 * Os NOMES não ficam aqui: o frontend usa Intl.DisplayNames (pt/en). Mantenha em sincronia com src/lib/countries.ts.
 */
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

/** Grupos aceitos em `eligibleNationalities` (prefixo @). Fontes: União Africana (54), CPLP (9), Commonwealth (56). */
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
export const COUNTRY_GROUP_KEYS = Object.keys(COUNTRY_GROUPS) as CountryGroup[];

const codeSet = new Set<string>(COUNTRY_CODES);
export const isCountryCode = (v: unknown): v is CountryCode => typeof v === "string" && codeSet.has(v);
export const isCountryOrGroup = (v: unknown): boolean => isCountryCode(v) || (typeof v === "string" && v in COUNTRY_GROUPS);

/** Expande grupos (@AFRICA…) em códigos. Lista vazia = qualquer país. */
export function expandCountries(list: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const item of list) {
    if (item in COUNTRY_GROUPS) for (const c of COUNTRY_GROUPS[item as CountryGroup]) out.add(c);
    else out.add(item);
  }
  return out;
}
