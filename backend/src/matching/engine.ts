import { expandCountries } from "./countries.js";
import type { CompletedLevel, Coverage, LanguageLevel, ScholarshipMatch, StudentProfile, TargetLevel } from "./model.js";

/**
 * Motor de compatibilidade. Função PURA (sem base de dados): perfil + critérios da bolsa → elegibilidade, nota e motivos.
 *
 * 1. Filtros eliminatórios (requisito obrigatório conhecido e não cumprido) → "not_eligible".
 * 2. Informação que falta no perfil para decidir → "possible".
 * 3. Nota 0–100 pela soma de pesos (área, financiamento, idioma, nota acadêmica, destino, prazo, taxa, experiência).
 *
 * Os motivos são CÓDIGOS com parâmetros: o frontend escreve a frase em PT ou EN.
 */

export type ReasonKind = "met" | "gap" | "missing" | "failed" | "info";
export type Reason = { kind: ReasonKind; code: string; params?: Record<string, string | number | string[]> };
export type Eligibility = "eligible" | "possible" | "not_eligible";
export type MatchResult = { eligibility: Eligibility; score: number; fit: "high" | "medium" | "low"; reasons: Reason[] };

export type MatchableScholarship = { deadline: string; match: ScholarshipMatch };

const LEVEL_RANK: Record<LanguageLevel, number> = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6, native: 7 };
const COMPLETED_RANK: Record<CompletedLevel, number> = { secondary: 1, bachelor: 2, master: 3, phd: 4 };
/** O que normalmente precisa estar concluído para cursar cada nível. */
const PREREQUISITE: Record<TargetLevel, CompletedLevel | null> = {
  bachelor: "secondary", master: "bachelor", phd: "bachelor", postdoc: "phd", short_course: null
};

/** Motivos que deixam a elegibilidade em aberto ("possible"): falta informação de um requisito, ou ele ainda não foi cumprido. */
const UNCERTAIN = new Set([
  "nationality_missing", "level_missing", "prerequisite_missing", "group_missing", "age_missing", "work_missing",
  "language_missing", "language_gap", "test_needed", "test_gap", "gpa_missing", "gpa_gap"
]);

export const WEIGHTS = { field: 25, funding: 20, language: 15, academic: 15, destination: 10, deadline: 5, fee: 5, experience: 5 } as const;

/** Nota acadêmica em % (escala de 0 a 100), para comparar escalas diferentes (0–20, 0–4, …). */
export function gpaPercent(gpa: StudentProfile["gpa"]): number | null {
  if (!gpa) return null;
  return Math.round((gpa.value / Number(gpa.scale)) * 1000) / 10;
}

const daysUntil = (deadline: string, today: Date) =>
  Math.floor((Date.parse(`${deadline}T23:59:59Z`) - today.getTime()) / 86_400_000);

/** O que o estudante precisa que a bolsa cubra (explícito, ou deduzido do tipo de necessidade). */
function neededCoverage(p: StudentProfile): Coverage[] {
  if (p.needsCoverage.length > 0) return p.needsCoverage;
  if (p.fundingNeed === "full") return ["tuition", "living", "travel", "accommodation"];
  if (p.fundingNeed === "partial") return ["tuition"];
  return [];
}

export function matchScholarship(p: StudentProfile, s: MatchableScholarship, today = new Date()): MatchResult {
  const m = s.match;
  const reasons: Reason[] = [];
  const add = (kind: ReasonKind, code: string, params?: Reason["params"]) => reasons.push(params ? { kind, code, params } : { kind, code });
  let score = 0;

  // ── Prazo ────────────────────────────────────────────────────────────────
  const days = daysUntil(s.deadline, today);
  if (days < 0) add("failed", "deadline_closed");
  else {
    score += days >= 45 ? WEIGHTS.deadline : days >= 14 ? 3 : 1;
    if (days < 30) add("info", "deadline_soon", { days });
  }

  // ── Nacionalidade ────────────────────────────────────────────────────────
  if (m.eligibleNationalities.length > 0) {
    const allowed = expandCountries(m.eligibleNationalities);
    if (p.nationalities.length === 0) add("missing", "nationality_missing");
    else if (p.nationalities.some((c) => allowed.has(c))) add("met", "nationality_ok");
    else add("failed", "nationality_not_eligible");
  }

  // ── Nível desejado e pré-requisito ──────────────────────────────────────
  if (p.targetLevels.length === 0) add("missing", "level_missing");
  else if (p.targetLevels.some((l) => m.levels.includes(l))) add("met", "level_ok", { levels: m.levels.filter((l) => p.targetLevels.includes(l)) });
  else add("failed", "level_not_offered", { levels: m.levels });

  const prerequisite = m.requiredCompletedLevel ?? lowestPrerequisite(m.levels, p.targetLevels);
  if (prerequisite) {
    if (!p.completedLevel) add("missing", "prerequisite_missing", { level: prerequisite });
    else if (COMPLETED_RANK[p.completedLevel] >= COMPLETED_RANK[prerequisite]) add("met", "prerequisite_ok", { level: prerequisite });
    else add("failed", "prerequisite_failed", { level: prerequisite });
  }

  // ── Público restrito, idade, experiência obrigatória, modalidade, destino excluído ──
  if (m.restrictedTo.length > 0) {
    if (p.groups.some((g) => m.restrictedTo.includes(g))) add("met", "group_ok", { groups: m.restrictedTo });
    else if (p.groups.length === 0) add("missing", "group_missing", { groups: m.restrictedTo });
    else add("failed", "group_restricted", { groups: m.restrictedTo });
  }
  if (m.maxAge !== null) {
    if (p.birthYear === null) add("missing", "age_missing", { max: m.maxAge });
    else if (today.getUTCFullYear() - p.birthYear <= m.maxAge) add("met", "age_ok", { max: m.maxAge });
    else add("failed", "age_failed", { max: m.maxAge });
  }
  if (m.minWorkYears !== null && m.minWorkYears > 0) {
    if (p.workYears === null) add("missing", "work_missing", { min: m.minWorkYears });
    else if (p.workYears >= m.minWorkYears) add("met", "work_ok", { min: m.minWorkYears });
    else add("failed", "work_failed", { min: m.minWorkYears, yours: p.workYears });
  }
  score += WEIGHTS.experience;
  if (p.studyMode === "online" && m.studyMode === "onsite") add("failed", "mode_mismatch", { mode: m.studyMode });
  else if (p.studyMode === "onsite" && m.studyMode === "online") add("failed", "mode_mismatch", { mode: m.studyMode });
  if (m.destinations.length > 0 && m.destinations.every((c) => p.excludedDestinations.includes(c))) {
    add("failed", "destination_excluded", { countries: m.destinations });
  }

  // ── Financiamento ────────────────────────────────────────────────────────
  const needed = neededCoverage(p);
  if (!p.fundingNeed && p.needsCoverage.length === 0) {
    add("missing", "funding_missing");
    score += 10;
  } else if (needed.length === 0) {
    score += WEIGHTS.funding;
  } else {
    const covered = needed.filter((c) => m.coverage.includes(c));
    const uncovered = needed.filter((c) => !m.coverage.includes(c));
    score += Math.round((covered.length / needed.length) * WEIGHTS.funding);
    if (p.fundingNeed === "full" && !(m.coverage.includes("tuition") && m.coverage.includes("living"))) {
      add("failed", "funding_insufficient", { uncovered });
    } else if (uncovered.length === 0) add("met", "funding_ok", { covered });
    else add("gap", "funding_partial", { covered, uncovered });
  }

  // ── Área ─────────────────────────────────────────────────────────────────
  if (m.fields.length === 0) {
    score += p.fields.length > 0 ? 18 : 15;
    add("met", "field_any");
  } else if (p.fields.length === 0) {
    score += 10;
    add("missing", "field_missing");
  } else if (p.fields.some((f) => m.fields.includes(f))) {
    score += WEIGHTS.field;
    add("met", "field_ok", { fields: m.fields.filter((f) => p.fields.includes(f)) });
  } else add("gap", "field_mismatch", { fields: m.fields });

  // ── Idiomas e testes ─────────────────────────────────────────────────────
  let language: number = WEIGHTS.language;
  for (const req of m.languages) {
    const mine = p.languages.find((l) => l.code === req.code);
    if (p.languages.length === 0) { language = Math.min(language, 7); add("missing", "language_missing", { code: req.code, min: req.minLevel }); }
    else if (!mine) { language = Math.min(language, 2); add("gap", "language_gap", { code: req.code, min: req.minLevel, yours: "none" }); }
    else if (LEVEL_RANK[mine.level] >= LEVEL_RANK[req.minLevel]) add("met", "language_ok", { code: req.code, min: req.minLevel });
    else { language = Math.min(language, 4); add("gap", "language_gap", { code: req.code, min: req.minLevel, yours: mine.level }); }
  }
  if (m.tests.length > 0) {
    const passed = m.tests.find((t) => p.tests.some((x) => x.type === t.type && x.score >= t.minScore));
    if (passed) add("met", "test_ok", { type: passed.type, min: passed.minScore });
    else {
      const taken = m.tests.find((t) => p.tests.some((x) => x.type === t.type));
      const options = m.tests.map((t) => `${t.type}:${t.minScore}`);
      if (taken) {
        language = Math.min(language, 6);
        add("gap", "test_gap", { type: taken.type, min: taken.minScore, yours: p.tests.find((x) => x.type === taken.type)!.score });
      } else {
        language = Math.min(language, 11);
        add("gap", "test_needed", { options });
      }
    }
  }
  score += language;

  // ── Nota acadêmica ───────────────────────────────────────────────────────
  const pct = gpaPercent(p.gpa);
  if (m.minGpaPercent === null) score += pct !== null && pct >= 70 ? WEIGHTS.academic : 12;
  else if (pct === null) { score += 7; add("missing", "gpa_missing", { min: m.minGpaPercent }); }
  else if (pct >= m.minGpaPercent) { score += pct >= m.minGpaPercent + 10 ? WEIGHTS.academic : 12; add("met", "gpa_ok", { min: m.minGpaPercent, yours: pct }); }
  else { score += 2; add("gap", "gpa_gap", { min: m.minGpaPercent, yours: pct }); }

  // ── Destino preferido ────────────────────────────────────────────────────
  if (p.destinations.length === 0 || m.destinations.length === 0) score += 7;
  else if (m.destinations.some((c) => p.destinations.includes(c))) {
    score += WEIGHTS.destination;
    add("met", "destination_preferred", { countries: m.destinations.filter((c) => p.destinations.includes(c)) });
  } else score += 3;

  // ── Taxa de candidatura ──────────────────────────────────────────────────
  if (!m.applicationFee) score += WEIGHTS.fee;
  else if (p.canPayApplicationFee === true) { score += 4; add("info", "fee_required"); }
  else if (p.canPayApplicationFee === false) add("gap", "fee_cannot_pay");
  else { score += 3; add("info", "fee_required"); }

  // Elegibilidade olha só para REQUISITOS (área, financiamento e destino mudam a nota, não a elegibilidade).
  const eligibility: Eligibility = reasons.some((r) => r.kind === "failed") ? "not_eligible"
    : reasons.some((r) => UNCERTAIN.has(r.code)) ? "possible" : "eligible";
  const finalScore = eligibility === "not_eligible" ? 0 : Math.max(0, Math.min(100, score));
  const fit = finalScore >= 75 ? "high" : finalScore >= 55 ? "medium" : "low";
  const order: Record<ReasonKind, number> = { failed: 0, gap: 1, missing: 2, met: 3, info: 4 };
  reasons.sort((a, b) => order[a.kind] - order[b.kind]);
  return { eligibility, score: finalScore, fit, reasons };
}

/** Pré-requisito mais baixo entre os níveis que a bolsa financia E o estudante quer (ou todos, se não informou). */
function lowestPrerequisite(levels: TargetLevel[], wanted: TargetLevel[]): CompletedLevel | null {
  const relevant = wanted.length > 0 && levels.some((l) => wanted.includes(l)) ? levels.filter((l) => wanted.includes(l)) : levels;
  const prereqs = relevant.map((l) => PREREQUISITE[l]);
  if (prereqs.includes(null)) return null;
  return (prereqs as CompletedLevel[]).sort((a, b) => COMPLETED_RANK[a] - COMPLETED_RANK[b])[0] ?? null;
}

/** Itens do perfil que mais afetam a recomendação, para a barra de "perfil completo". */
export const COMPLETENESS_ITEMS: { key: string; filled: (p: StudentProfile) => boolean }[] = [
  { key: "nationalities", filled: (p) => p.nationalities.length > 0 },
  { key: "residenceCountry", filled: (p) => p.residenceCountry !== "" },
  { key: "completedLevel", filled: (p) => p.completedLevel !== "" },
  { key: "targetLevels", filled: (p) => p.targetLevels.length > 0 },
  { key: "fields", filled: (p) => p.fields.length > 0 },
  { key: "gpa", filled: (p) => p.gpa !== null },
  { key: "languages", filled: (p) => p.languages.length > 0 },
  { key: "fundingNeed", filled: (p) => p.fundingNeed !== "" },
  { key: "birthYear", filled: (p) => p.birthYear !== null },
  { key: "workYears", filled: (p) => p.workYears !== null },
  { key: "studyMode", filled: (p) => p.studyMode !== "" },
  { key: "startYear", filled: (p) => p.startYear !== null }
];

export function profileCompleteness(p: StudentProfile): { percent: number; missing: string[] } {
  const missing = COMPLETENESS_ITEMS.filter((i) => !i.filled(p)).map((i) => i.key);
  return { percent: Math.round(((COMPLETENESS_ITEMS.length - missing.length) / COMPLETENESS_ITEMS.length) * 100), missing };
}
