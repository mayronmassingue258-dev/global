import type { EligibilityResult, Recommendation } from "@/types";
import { scholarships } from "./scholarships";

// RESULTADOS FICTÍCIOS (modo demonstração). Na versão real, o backend calcula tudo a partir do perfil salvo.
export const eligibilityResults: Record<string, EligibilityResult> = {
  "amostra-001": { scholarshipId: "amostra-001", status: "eligible", score: 86, fit: "high", reasons: [
    { kind: "met", code: "nationality_ok" }, { kind: "met", code: "level_ok", params: { levels: ["master"] } },
    { kind: "met", code: "funding_ok", params: { covered: ["tuition", "living", "travel", "accommodation"] } }, { kind: "met", code: "field_ok", params: { fields: ["computer_science"] } }] },
  "amostra-002": { scholarshipId: "amostra-002", status: "possible", score: 58, fit: "medium", reasons: [
    { kind: "missing", code: "gpa_missing", params: { min: 70 } }, { kind: "gap", code: "language_gap", params: { code: "en", min: "C1", yours: "B2" } },
    { kind: "met", code: "level_ok", params: { levels: ["phd"] } }] },
  "amostra-003": { scholarshipId: "amostra-003", status: "possible", score: 47, fit: "low", reasons: [
    { kind: "missing", code: "age_missing", params: { max: 25 } }, { kind: "info", code: "fee_required" }] },
  "amostra-004": { scholarshipId: "amostra-004", status: "not_eligible", score: 0, fit: "low", reasons: [{ kind: "failed", code: "nationality_not_eligible" }] },
  "amostra-005": { scholarshipId: "amostra-005", status: "eligible", score: 64, fit: "medium", reasons: [{ kind: "met", code: "field_any" }, { kind: "met", code: "level_ok", params: { levels: ["short_course"] } }] },
  "amostra-006": { scholarshipId: "amostra-006", status: "possible", score: 52, fit: "low", reasons: [
    { kind: "missing", code: "work_missing", params: { min: 2 } }, { kind: "gap", code: "test_needed", params: { options: ["ielts:7"] } }] }
};

/** Recomendações fictícias: as bolsas de demonstração não eliminadas, da maior nota para a menor. */
export function mockRecommendations(saved: Set<string>): Recommendation[] {
  return scholarships
    .map((scholarship) => ({ scholarship, result: eligibilityResults[scholarship.id] }))
    .filter((x): x is { scholarship: typeof x.scholarship; result: EligibilityResult } => Boolean(x.result) && x.result!.status !== "not_eligible")
    .sort((a, b) => b.result.score - a.result.score)
    .map(({ scholarship, result }) => ({
      scholarship, eligibility: result.status as "eligible" | "possible", score: result.score, fit: result.fit, reasons: result.reasons, saved: saved.has(scholarship.id)
    }));
}
