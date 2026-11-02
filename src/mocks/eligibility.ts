import type { EligibilityResult } from "@/types";

// RESULTADOS FICTÍCIOS. Na versão real, a elegibilidade é calculada pelo backend.
export const eligibilityResults: Record<string, EligibilityResult> = {
  "amostra-001": { scholarshipId: "amostra-001", status: "eligible", reasons: [
    { kind: "met", text: "Nível de estudo compatível com o seu perfil." },
    { kind: "met", text: "País de residência está entre os elegíveis." }] },
  "amostra-002": { scholarshipId: "amostra-002", status: "possible", reasons: [
    { kind: "met", text: "Nível de estudo compatível." },
    { kind: "missing", text: "Falta informar: nota do mestrado." },
    { kind: "missing", text: "Falta informar: idiomas e níveis." }] },
  "amostra-003": { scholarshipId: "amostra-003", status: "possible", reasons: [{ kind: "missing", text: "Falta informar: média final." }] },
  "amostra-004": { scholarshipId: "amostra-004", status: "not_eligible", reasons: [
    { kind: "failed", text: "Requisito obrigatório não atendido: vínculo com instituição de origem." }] },
  "amostra-005": { scholarshipId: "amostra-005", status: "eligible", reasons: [{ kind: "met", text: "Nenhuma restrição conhecida para o seu perfil." }] },
  "amostra-006": { scholarshipId: "amostra-006", status: "possible", reasons: [{ kind: "missing", text: "Falta informar: idiomas e níveis." }] }
};
