"use client";

import { useT } from "@/i18n/I18nProvider";
import { countryName } from "@/lib/matching";
import type { ScholarshipMatch } from "@/types";
import { countryList, joinList } from "./reasons";
import styles from "./ScholarshipCriteria.module.css";

/** "Quem pode se candidatar": os critérios estruturados da bolsa, no idioma da interface. */
export function ScholarshipCriteria({ match }: { match: ScholarshipMatch }) {
  const t = useT();
  const c = t.criteria;
  const v = t.vocab;
  const locale = t.meta.htmlLang;
  const labels = <K extends string>(table: Record<K, string>, codes: string[]) => joinList(codes.map((x) => table[x as K] ?? x), locale);

  const rows: [string, string][] = [
    [c.levels, labels(v.targetLevel, match.levels)],
    [c.nationalities, match.eligibleNationalities.length > 0 ? countryList(match.eligibleNationalities, t) : c.anyNationality],
    [c.destinations, match.destinations.length > 0 ? joinList(match.destinations.map((d) => countryName(d, locale)), locale) : "—"],
    [c.fields, match.fields.length > 0 ? labels(v.field, match.fields) : c.anyField],
    [c.coverage, match.coverage.length > 0 ? labels(v.coverage, match.coverage) : c.notInformed]
  ];
  if (match.languages.length > 0) rows.push([c.languages, joinList(match.languages.map((l) => `${v.language[l.code] ?? l.code} ${l.minLevel}`), locale)]);
  if (match.tests.length > 0) rows.push([c.tests, match.tests.map((x) => `${v.test[x.type] ?? x.type} ${x.minScore}`).join(" · ")]);
  if (match.minGpaPercent !== null) rows.push([c.minGpa, c.minGpaValue(match.minGpaPercent)]);
  if (match.requiredCompletedLevel) rows.push([c.prerequisite, v.completedLevel[match.requiredCompletedLevel] ?? match.requiredCompletedLevel]);
  if (match.maxAge !== null) rows.push([c.maxAge, c.years(match.maxAge)]);
  if (match.minWorkYears) rows.push([c.minWork, c.years(match.minWorkYears)]);
  if (match.restrictedTo.length > 0) rows.push([c.restricted, labels(v.group, match.restrictedTo)]);
  rows.push([c.mode, v.scholarshipMode[match.studyMode] ?? match.studyMode]);
  rows.push([c.fee, match.applicationFee ? c.feeYes : c.feeNo]);

  return (
    <dl className={styles.list}>
      {rows.map(([term, value]) => (
        <div key={term}><dt>{term}</dt><dd>{value}</dd></div>
      ))}
    </dl>
  );
}
