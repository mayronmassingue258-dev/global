import { z } from "zod";
import { COMPLETED_LEVELS, COVERAGE, FIELDS, GROUPS, LANGUAGE_LEVELS, LANGUAGES, SCHOLARSHIP_MODES, TARGET_LEVELS, TESTS } from "../matching/model.js";
import { STUDY_LEVELS } from "../lib/validation.js";
import type { DiscoverySource } from "./sources.js";

/**
 * Partes comuns aos motores de busca (Gemini e Claude): o formato da resposta, as instruções e a leitura do JSON.
 * Quem decide o que é publicado é publish.ts, com validação própria.
 */

const nullable = (schema: object) => ({ anyOf: [schema, { type: "null" }] });
const enumOf = (values: readonly string[]) => ({ type: "string", enum: [...values] });
const strings = { type: "array", items: { type: "string" } };
const obj = (properties: Record<string, object>) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });

/** Esquema da resposta (JSON Schema no subconjunto aceito pela saída estruturada: sem min/max, todos os objetos fechados). */
export const EXTRACTION_SCHEMA = obj({
  scholarships: {
    type: "array",
    items: obj({
      programKey: { type: "string", description: "Chave curta e estável do programa, em minúsculas com hífen (ex.: chevening-mestrado). Reutilize a chave de uma bolsa já conhecida se for a mesma." },
      title: { type: "string", description: "Nome da bolsa em português." },
      institution: { type: "string" },
      country: { type: "string", description: "País de estudo, em português (ex.: Reino Unido). Vários países: 'Vários países'." },
      level: enumOf(STUDY_LEVELS),
      fundingType: enumOf(["Integral", "Parcial", "Auxílio mensal"]),
      funding: { type: "string", description: "O que a bolsa cobre, em português, com valores se o edital disser." },
      deadline: { type: "string", description: "Prazo de candidatura do ciclo atual ou do próximo, AAAA-MM-DD. Vazio se o edital não tiver data." },
      deadlineEvidence: { type: "string", description: "Trecho do edital (até 200 caracteres) com a data do prazo." },
      summary: { type: "string", description: "Resumo de 1 a 3 frases, em português." },
      requirements: strings,
      requiredDocuments: strings,
      applicationProcess: { type: "string" },
      sourceUrl: { type: "string", description: "Endereço https da página oficial do edital (de onde os dados vieram)." },
      match: obj({
        levels: { type: "array", items: enumOf(TARGET_LEVELS) },
        fields: { type: "array", items: enumOf(FIELDS) },
        eligibleNationalities: { ...strings, description: "Códigos ISO 3166-1 alfa-2 (MZ, AO, CV, GW, ST, BR, TL…) ou @AFRICA, @CPLP, @COMMONWEALTH. Vazio = qualquer nacionalidade." },
        destinations: { ...strings, description: "Países de estudo, códigos ISO." },
        coverage: { type: "array", items: enumOf(COVERAGE) },
        languages: { type: "array", items: obj({ code: enumOf(LANGUAGES), minLevel: enumOf(LANGUAGE_LEVELS) }) },
        tests: { type: "array", items: obj({ type: enumOf(TESTS), minScore: { type: "number" } }) },
        minGpaPercent: nullable({ type: "number" }),
        requiredCompletedLevel: nullable(enumOf(COMPLETED_LEVELS)),
        maxAge: nullable({ type: "integer" }),
        minWorkYears: nullable({ type: "integer" }),
        restrictedTo: { type: "array", items: enumOf(GROUPS) },
        applicationFee: { type: "boolean" },
        studyMode: enumOf(SCHOLARSHIP_MODES)
      })
    })
  },
  notes: { type: "string", description: "Observações curtas: páginas que não abriram, ciclos ainda sem data, etc." }
});

/** Mesma forma, em zod, para validar o que voltou antes de qualquer outra coisa. */
const extracted = z.object({
  scholarships: z.array(z.object({
    programKey: z.string(), title: z.string(), institution: z.string(), country: z.string(), level: z.string(), fundingType: z.string(),
    funding: z.string(), deadline: z.string(), deadlineEvidence: z.string(), summary: z.string(), requirements: z.array(z.string()),
    requiredDocuments: z.array(z.string()), applicationProcess: z.string(), sourceUrl: z.string(), match: z.record(z.string(), z.unknown())
  })),
  notes: z.string()
});
export type ExtractedScholarship = z.infer<typeof extracted>["scholarships"][number];


export const SYSTEM = `Você coleta bolsas de estudo REAIS para uma plataforma gratuita que ajuda estudantes lusófonos (Moçambique, Angola, Cabo Verde, Guiné-Bissau, São Tomé e Príncipe, Brasil, Timor-Leste) a encontrar bolsas.

Regras:
- Use só informação das páginas oficiais que você pesquisar e abrir. Nunca invente dados; se algo não estiver na página, deixe vazio, lista vazia ou null.
- Inclua apenas bolsas com candidaturas abertas agora ou com abertura anunciada para os próximos 12 meses e com prazo conhecido (data exata).
- Inclua apenas bolsas que estudantes de pelo menos um país lusófono possam pedir (ou abertas a qualquer nacionalidade).
- Prazos: o do ciclo atual ou do próximo; copie o trecho do edital que mostra a data em deadlineEvidence.
- Textos (título, resumo, cobertura, requisitos, documentos, processo) em português, claros e curtos.
- Critérios (match) em códigos. Nacionalidades: códigos ISO 3166-1 alfa-2 ou os grupos @AFRICA, @CPLP, @COMMONWEALTH. Nota mínima em % da escala.
- No máximo 15 bolsas por fonte. Se não achar nenhuma que cumpra as regras, devolva a lista vazia e explique em notes.`;

export function userPrompt(source: DiscoverySource, known: { id: string; title: string }[], today: string): string {
  const where = source.broad
    ? [
        "Pesquise na web bolsas que combinem com o estudante abaixo. Use SÓ páginas oficiais: governos, universidades, fundações e organismos internacionais (ex.: domínios .gov, .edu, .ac.xx, europa.eu). Nunca use agregadores, blogs ou sites de notícias como fonte.",
        `Programas oficiais conhecidos, por onde também pode começar: ${source.domains.slice(0, 25).join(", ")}`
      ]
    : [
        `Sites oficiais permitidos (use SÓ páginas destes domínios; na pesquisa, use site:${source.domains[0]}): ${source.domains.join(", ")}`,
        `Comece por: ${source.domains.map((d) => `https://${d}/`).join(" ")}`
      ];
  return [
    `Fonte: ${source.name}`,
    ...where,
    `O que procurar: ${source.hint}`,
    `Data de hoje: ${today}.`,
    known.length > 0
      ? `Bolsas desta fonte que já temos (reutilize a programKey, a parte depois de "${source.id}-", se for a mesma bolsa):\n${known.map((k) => `- ${k.id}: ${k.title}`).join("\n")}`
      : "Ainda não temos bolsas desta fonte.",
    "Pesquise, abra as páginas dos editais e devolva o JSON."
  ].join("\n\n");
}

export type Usage = { inputTokens: number; outputTokens: number; searches: number; fetches: number; requests: number; costUsd: number };
export const emptyUsage = (): Usage => ({ inputTokens: 0, outputTokens: 0, searches: 0, fetches: 0, requests: 0, costUsd: 0 });
export const sumUsage = (a: Usage, b: Usage): Usage => ({
  inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens, searches: a.searches + b.searches,
  fetches: a.fetches + b.fetches, requests: a.requests + b.requests, costUsd: a.costUsd + b.costUsd
});

export type ExtractResult = { scholarships: ExtractedScholarship[]; notes: string; usage: Usage; problem?: string };

/** Um motor de busca: recebe a fonte e devolve as bolsas encontradas (ainda sem filtro). */
export type Researcher = (source: DiscoverySource, known: { id: string; title: string }[], today: string) => Promise<ExtractResult>;

/** Lê o JSON devolvido pelo modelo (tolerando cercas ```json). */
export function parseExtraction(text: string): Omit<ExtractResult, "usage"> {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let json: unknown;
  try {
    json = JSON.parse(clean);
  } catch {
    return { scholarships: [], notes: "", problem: "resposta não é JSON" };
  }
  const parsed = extracted.safeParse(json);
  if (!parsed.success) return { scholarships: [], notes: "", problem: "JSON fora do formato" };
  return { scholarships: parsed.data.scholarships, notes: parsed.data.notes };
}
