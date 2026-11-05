/**
 * Motor de elegibilidade. Compara o perfil salvo com os critérios da bolsa e devolve motivos legíveis.
 * Regras simples e explicáveis: nada de probabilidades. O frontend só exibe o resultado.
 */
export type Reason = { kind: "met" | "missing" | "failed"; text: string };
export type EligibilityResult = { scholarshipId: string; status: "eligible" | "possible" | "not_eligible"; reasons: Reason[] };
type Profile = Record<string, string>;

const NEED_LABEL: Record<string, string> = {
  grade: "resultado acadêmico e escala",
  languages: "idiomas e níveis",
  field: "área de estudo",
  nationality: "nacionalidade"
};

const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

export function evaluateEligibility(
  scholarship: { id: string; eligibleCountries: string[] | null },
  criteria: { acceptedLevels: string[]; needs: string[] } | null,
  profile: Profile
): EligibilityResult {
  const reasons: Reason[] = [];
  const countries = scholarship.eligibleCountries ?? [];
  const levels = criteria?.acceptedLevels ?? [];
  const needs = criteria?.needs ?? [];
  const residence = profile.residence?.trim() ?? "";
  const level = profile.level?.trim() ?? "";

  if (!residence) reasons.push({ kind: "missing", text: "Falta informar: país de residência." });
  else if (countries.length > 0) {
    reasons.push(countries.some((c) => normalize(c) === normalize(residence))
      ? { kind: "met", text: "País de residência está entre os elegíveis." }
      : { kind: "failed", text: "Requisito obrigatório não atendido: país de residência fora da lista de países elegíveis." });
  }

  if (!level) reasons.push({ kind: "missing", text: "Falta informar: nível de estudo atual." });
  else if (levels.length > 0) {
    reasons.push(levels.includes(level)
      ? { kind: "met", text: "Nível de estudo compatível com o programa." }
      : { kind: "failed", text: "Requisito obrigatório não atendido: nível de estudo atual incompatível com o programa." });
  }

  for (const key of needs) {
    const label = NEED_LABEL[key] ?? key;
    reasons.push(profile[key]?.trim()
      ? { kind: "met", text: `Informado: ${label} (o provedor confirma o valor).` }
      : { kind: "missing", text: `Falta informar: ${label}.` });
  }

  if (reasons.length === 0) reasons.push({ kind: "met", text: "Nenhuma restrição conhecida para o seu perfil." });
  const status = reasons.some((r) => r.kind === "failed") ? "not_eligible" : reasons.some((r) => r.kind === "missing") ? "possible" : "eligible";
  return { scholarshipId: scholarship.id, status, reasons };
}
