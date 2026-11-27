import type { StudentProfile } from "../matching/model.js";
import { OFFICIAL_DOMAINS, type DiscoverySource } from "./sources.js";

/**
 * Busca guiada pelo perfil do estudante (botão "Procurar novas bolsas para mim"): uma busca aberta na web, com os
 * dados do perfil que mais pesam na elegibilidade. Os resultados passam pelos MESMOS filtros de publicação
 * (link oficial, prazo aberto, país lusófono) e ficam disponíveis para todos os estudantes.
 */
export const PROFILE_SOURCE_ID = "web";

/** O perfil tem o mínimo para guiar a busca? */
export const profileReady = (p: StudentProfile) => p.nationalities.length > 0 && p.targetLevels.length > 0;

export function profileSource(p: StudentProfile): DiscoverySource {
  const parts = [
    `Estudante com nacionalidade ${p.nationalities.join(" e ")}${p.residenceCountry ? `, mora em ${p.residenceCountry}` : ""}.`,
    `Quer cursar: ${p.targetLevels.join(", ")}.`,
    p.fields.length > 0 ? `Áreas: ${p.fields.join(", ")}${p.fieldDetail ? ` (${p.fieldDetail})` : ""}.` : "",
    p.destinations.length > 0 ? `Destinos preferidos: ${p.destinations.join(", ")}.` : "Qualquer destino.",
    p.excludedDestinations.length > 0 ? `Não quer estudar em: ${p.excludedDestinations.join(", ")}.` : "",
    p.fundingNeed === "full" ? "Precisa de bolsa integral (propinas e sustento)." : p.fundingNeed === "partial" ? "Aceita bolsa parcial." : "",
    p.languages.length > 0 ? `Idiomas: ${p.languages.map((l) => `${l.code} ${l.level}`).join(", ")}.` : "",
    p.studyMode === "online" ? "Prefere estudar a distância." : ""
  ].filter(Boolean);
  return {
    id: PROFILE_SOURCE_ID,
    name: "Pesquisa na web pelo perfil do estudante",
    domains: OFFICIAL_DOMAINS,
    hint: `${parts.join(" ")} Procure bolsas que este estudante possa pedir, além das mais conhecidas.`,
    broad: true
  };
}
