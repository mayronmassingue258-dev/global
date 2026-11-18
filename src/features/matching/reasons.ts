import type { Dictionary } from "@/i18n/dictionaries/pt";
import { countryName } from "@/lib/matching";
import type { Reason } from "@/types";

type Params = NonNullable<Reason["params"]>;
const list = (v: Params[string] | undefined): string[] => (Array.isArray(v) ? v : typeof v === "string" ? [v] : []);
const num = (v: Params[string] | undefined) => (typeof v === "number" ? v : Number(v ?? 0));
const str = (v: Params[string] | undefined) => (typeof v === "string" ? v : String(v ?? ""));

/** Rótulo de um código do vocabulário (com o próprio código como reserva, se o servidor mandar algo novo). */
const label = (table: Record<string, string>, code: string) => table[code] ?? code;

/** Lista legível: "A, B e C" / "A, B and C". */
export function joinList(items: string[], locale: string): string {
  if (items.length === 0) return "";
  try {
    return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(items);
  } catch {
    return items.join(", ");
  }
}

/** Países e grupos (@AFRICA…) com nomes no idioma da interface. */
export function countryList(codes: string[], t: Dictionary): string {
  const locale = t.meta.htmlLang;
  return joinList(codes.map((c) => (c.startsWith("@") ? label(t.vocab.countryGroup, c) : countryName(c, locale))), locale);
}

/** Opções de teste vindas do servidor como "ielts:6.5". */
function testOptions(options: string[], t: Dictionary) {
  const items = options.map((o) => {
    const [type, min] = o.split(":");
    return `${label(t.vocab.test, type ?? "")} ${min ?? ""}`.trim();
  });
  try {
    return new Intl.ListFormat(t.meta.htmlLang, { type: "disjunction" }).format(items);
  } catch {
    return items.join(", ");
  }
}

/** Escreve o motivo (código + parâmetros do servidor) como frase em PT ou EN. */
export function reasonText(reason: Reason, t: Dictionary): string {
  const p = reason.params ?? {};
  const r = t.reasons;
  const v = t.vocab;
  const locale = t.meta.htmlLang;
  const levels = (key: string) => joinList(list(p[key]).map((l) => label(v.targetLevel, l)), locale);
  const coverage = (key: string) => joinList(list(p[key]).map((c) => label(v.coverage, c).toLowerCase()), locale);
  const groups = () => joinList(list(p.groups).map((g) => label(v.group, g).toLowerCase()), locale);
  const lang = () => label(v.language, str(p.code));
  const langLevel = (key: string) => (str(p[key]) === "none" ? v.none : label(v.languageLevel, str(p[key])));

  switch (reason.code) {
    case "deadline_closed": return r.deadline_closed();
    case "deadline_soon": return r.deadline_soon(num(p.days));
    case "nationality_ok": return r.nationality_ok();
    case "nationality_not_eligible": return r.nationality_not_eligible();
    case "nationality_missing": return r.nationality_missing();
    case "level_ok": return r.level_ok(levels("levels"));
    case "level_not_offered": return r.level_not_offered(levels("levels"));
    case "level_missing": return r.level_missing();
    case "prerequisite_ok": return r.prerequisite_ok(label(v.completedLevel, str(p.level)).toLowerCase());
    case "prerequisite_failed": return r.prerequisite_failed(label(v.completedLevel, str(p.level)).toLowerCase());
    case "prerequisite_missing": return r.prerequisite_missing(label(v.completedLevel, str(p.level)).toLowerCase());
    case "group_ok": return r.group_ok(groups());
    case "group_restricted": return r.group_restricted(groups());
    case "group_missing": return r.group_missing(groups());
    case "age_ok": return r.age_ok(num(p.max));
    case "age_failed": return r.age_failed(num(p.max));
    case "age_missing": return r.age_missing(num(p.max));
    case "work_ok": return r.work_ok(num(p.min));
    case "work_failed": return r.work_failed(num(p.min), num(p.yours));
    case "work_missing": return r.work_missing(num(p.min));
    case "mode_mismatch": return r.mode_mismatch(label(v.scholarshipMode, str(p.mode)).toLowerCase());
    case "destination_excluded": return r.destination_excluded(countryList(list(p.countries), t));
    case "destination_preferred": return r.destination_preferred(countryList(list(p.countries), t));
    case "funding_ok": return r.funding_ok(coverage("covered"));
    case "funding_partial": return r.funding_partial(coverage("covered"), coverage("uncovered"));
    case "funding_insufficient": return r.funding_insufficient(coverage("uncovered"));
    case "funding_missing": return r.funding_missing();
    case "field_ok": return r.field_ok(joinList(list(p.fields).map((f) => label(v.field, f).toLowerCase()), locale));
    case "field_any": return r.field_any();
    case "field_mismatch": return r.field_mismatch(joinList(list(p.fields).map((f) => label(v.field, f).toLowerCase()), locale));
    case "field_missing": return r.field_missing();
    case "language_ok": return r.language_ok(lang(), str(p.min));
    case "language_gap": return r.language_gap(lang(), str(p.min), langLevel("yours"));
    case "language_missing": return r.language_missing(lang().toLowerCase(), str(p.min));
    case "test_ok": return r.test_ok(label(v.test, str(p.type)), num(p.min));
    case "test_gap": return r.test_gap(label(v.test, str(p.type)), num(p.min), num(p.yours));
    case "test_needed": return r.test_needed(testOptions(list(p.options), t));
    case "gpa_ok": return r.gpa_ok(num(p.min), num(p.yours));
    case "gpa_gap": return r.gpa_gap(num(p.min), num(p.yours));
    case "gpa_missing": return r.gpa_missing(num(p.min));
    case "fee_required": return r.fee_required();
    case "fee_cannot_pay": return r.fee_cannot_pay();
    default: return r.unknown;
  }
}
