// Regras FICTÍCIAS de elegibilidade do servidor local. No produto real quem calcula é o backend.

const NEED_LABEL = {
  grade: "resultado acadêmico e escala",
  languages: "idiomas e níveis",
  field: "área de estudo",
  nationality: "nacionalidade"
};

const normalize = (value) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/**
 * @param {{ id: string, eligibleCountries?: string[] }} scholarship
 * @param {{ acceptedLevels?: string[], needs?: string[] } | undefined} criteria
 * @param {Record<string, string>} profile
 */
export function evaluateEligibility(scholarship, criteria = {}, profile) {
  const reasons = [];
  const countries = scholarship.eligibleCountries ?? [];
  const levels = criteria.acceptedLevels ?? [];
  const needs = criteria.needs ?? [];

  if (!profile.residence?.trim()) {
    reasons.push({ kind: "missing", text: "Falta informar: país de residência." });
  } else if (countries.length > 0) {
    const ok = countries.some((c) => normalize(c) === normalize(profile.residence));
    reasons.push(
      ok
        ? { kind: "met", text: "País de residência está entre os elegíveis." }
        : { kind: "failed", text: "Requisito obrigatório não atendido: país de residência fora da lista de países elegíveis." }
    );
  }

  if (!profile.level?.trim()) {
    reasons.push({ kind: "missing", text: "Falta informar: nível de estudo atual." });
  } else if (levels.length > 0) {
    reasons.push(
      levels.includes(profile.level)
        ? { kind: "met", text: "Nível de estudo compatível com o programa." }
        : { kind: "failed", text: "Requisito obrigatório não atendido: nível de estudo atual incompatível com o programa." }
    );
  }

  for (const key of needs) {
    const label = NEED_LABEL[key] ?? key;
    reasons.push(
      profile[key]?.trim()
        ? { kind: "met", text: `Informado: ${label} (o provedor confirma o valor).` }
        : { kind: "missing", text: `Falta informar: ${label}.` }
    );
  }

  if (reasons.length === 0) reasons.push({ kind: "met", text: "Nenhuma restrição conhecida para o seu perfil." });

  const status = reasons.some((r) => r.kind === "failed") ? "not_eligible" : reasons.some((r) => r.kind === "missing") ? "possible" : "eligible";
  return { scholarshipId: scholarship.id, status, reasons };
}
