/**
 * Fontes OFICIAIS de bolsas. Para cada uma, o Claude só pode pesquisar e abrir páginas destes domínios
 * (web_search/web_fetch com allowed_domains), e a bolsa só é publicada se o link do edital for de um deles.
 *
 * Público do lançamento: estudantes lusófonos (Moçambique, Angola, Cabo Verde, Guiné-Bissau, São Tomé e Príncipe,
 * Brasil, Timor-Leste). Para acrescentar uma fonte: um item novo aqui, com o domínio do site oficial do programa
 * (governo, universidade ou fundação). Nunca agregadores ou blogs de bolsas.
 */
export type DiscoverySource = {
  /** Prefixo dos ids das bolsas desta fonte (letras minúsculas e hífen). */
  id: string;
  name: string;
  /** Domínios oficiais (subdomínios incluídos). */
  domains: string[];
  /** Onde começar e o que procurar (orienta a busca; o Claude decide as páginas). */
  hint: string;
};

export const SOURCES: DiscoverySource[] = [
  { id: "chevening", name: "Chevening (Reino Unido)", domains: ["chevening.org"], hint: "Bolsa Chevening de mestrado no Reino Unido: países elegíveis, prazo do ciclo atual, requisitos (experiência profissional, inglês)." },
  { id: "csc-uk", name: "Commonwealth Scholarship Commission (Reino Unido)", domains: ["cscuk.fcdo.gov.uk"], hint: "Commonwealth Master's e PhD Scholarships para países de baixa e média renda da Commonwealth (Moçambique é membro)." },
  { id: "daad", name: "DAAD (Alemanha)", domains: ["daad.de"], hint: "Bolsas DAAD para estudantes de países em desenvolvimento, em especial EPOS (programas de pós-graduação ligados ao desenvolvimento) e bolsas de doutorado para a África Subsaariana." },
  { id: "erasmus-mundus", name: "Erasmus Mundus (União Europeia)", domains: ["eacea.ec.europa.eu", "erasmus-plus.ec.europa.eu"], hint: "Mestrados conjuntos Erasmus Mundus com bolsa integral, abertos a estudantes de qualquer país. Liste os programas do catálogo com prazo aberto (no máximo 15)." },
  { id: "gulbenkian", name: "Fundação Calouste Gulbenkian (Portugal)", domains: ["gulbenkian.pt"], hint: "Bolsas de estudo para estudantes dos PALOP e de Timor-Leste (graduação, mestrado, doutorado) em Portugal ou no país de origem." },
  { id: "camoes", name: "Camões, Instituto da Cooperação e da Língua (Portugal)", domains: ["instituto-camoes.pt"], hint: "Bolsas de cooperação para estudantes dos PALOP e de Timor-Leste em instituições portuguesas." },
  { id: "brasil-pec", name: "Governo do Brasil (PEC-G / PEC-PG)", domains: ["gov.br"], hint: "Programas PEC-G (graduação) e PEC-PG (pós-graduação) do governo brasileiro para estudantes de países em desenvolvimento com acordo, incluindo os africanos de língua portuguesa." },
  { id: "stipendium-hungaricum", name: "Stipendium Hungaricum (Hungria)", domains: ["stipendiumhungaricum.hu"], hint: "Bolsa do governo húngaro para países parceiros (verifique se Moçambique, Angola, Cabo Verde ou Brasil estão na lista) em todos os níveis." },
  { id: "turkiye-burslari", name: "Türkiye Bursları (Turquia)", domains: ["turkiyeburslari.gov.tr"], hint: "Bolsa integral do governo turco para estudantes de todos os países, graduação a doutorado." },
  { id: "mext", name: "MEXT (Japão)", domains: ["studyinjapan.go.jp", "mext.go.jp"], hint: "Bolsa do governo japonês (MEXT) por recomendação da embaixada ou da universidade: níveis, idade máxima, calendário." },
  { id: "campus-china", name: "Bolsa do Governo Chinês (CSC)", domains: ["campuschina.org"], hint: "Chinese Government Scholarship para estudantes estrangeiros: tipos de bolsa, prazos, idade máxima." },
  { id: "gks-korea", name: "Global Korea Scholarship (Coreia do Sul)", domains: ["studyinkorea.go.kr"], hint: "GKS para graduação e pós-graduação: países elegíveis, prazos, idade." },
  { id: "si-sweden", name: "Swedish Institute (Suécia)", domains: ["si.se"], hint: "Swedish Institute Scholarships for Global Professionals (mestrado): lista de países elegíveis, exigência de experiência profissional e de liderança, prazo." },
  { id: "mastercard-foundation", name: "Mastercard Foundation Scholars Program", domains: ["mastercardfdn.org"], hint: "Programa de bolsas para jovens africanos com recursos limitados, por universidade parceira: liste as universidades com candidaturas abertas e os prazos." },
  { id: "fulbright", name: "Fulbright (Estados Unidos)", domains: ["foreign.fulbrightonline.org", "mz.usembassy.gov", "ao.usembassy.gov", "br.usembassy.gov"], hint: "Fulbright Foreign Student Program para mestrado e doutorado nos EUA, com foco nas páginas das embaixadas em Moçambique, Angola e Brasil (prazos por país)." },
  { id: "australia-awards", name: "Australia Awards Africa", domains: ["australiaawardsafrica.org"], hint: "Bolsas de mestrado na Austrália para países africanos elegíveis: países, áreas prioritárias, prazo." },
  { id: "aga-khan", name: "Aga Khan Foundation International Scholarship", domains: ["the.akdn"], hint: "Bolsas de pós-graduação (meio subsídio, meio empréstimo) para estudantes de países em desenvolvimento, incluindo Moçambique." },
  { id: "gates-cambridge", name: "Gates Cambridge (Reino Unido)", domains: ["gatescambridge.org"], hint: "Bolsa integral para pós-graduação na Universidade de Cambridge, aberta a cidadãos de fora do Reino Unido." },
  { id: "italy-maeci", name: "Bolsas do Governo Italiano (MAECI)", domains: ["studyinitaly.esteri.it"], hint: "Bolsas do governo italiano para estudantes estrangeiros (mestrado, doutorado, cursos): países elegíveis e prazo." },
  { id: "world-bank", name: "Banco Mundial (JJ/WBGSP)", domains: ["worldbank.org"], hint: "Joint Japan/World Bank Graduate Scholarship Program: mestrado em desenvolvimento para cidadãos de países em desenvolvimento, com experiência profissional." },
  { id: "afdb", name: "Banco Africano de Desenvolvimento (AfDB-JSP)", domains: ["afdb.org"], hint: "Programa de bolsas Japão–AfDB para mestrado em áreas de desenvolvimento para cidadãos de países africanos membros." },
  { id: "manaaki-nz", name: "Manaaki New Zealand Scholarships", domains: ["nzscholarships.govt.nz"], hint: "Bolsas do governo da Nova Zelândia para países elegíveis (confira se há países africanos de língua portuguesa)." }
];

/** O endereço é de um dos domínios da fonte (ou de um subdomínio)? */
export function isOfficialUrl(url: string, source: DiscoverySource): boolean {
  let host: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    host = parsed.hostname.toLowerCase();
  } catch {
    return false;
  }
  return source.domains.some((d) => host === d || host.endsWith(`.${d}`));
}

/** Rodízio: cada fonte entra numa semana sim, outra não (metade das fontes por execução, para conter o gasto). */
export function sourcesForWeek(date: Date, all: DiscoverySource[] = SOURCES): DiscoverySource[] {
  const week = Math.floor(date.getTime() / (7 * 86_400_000));
  return all.filter((_, i) => i % 2 === week % 2);
}
