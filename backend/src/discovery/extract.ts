import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { COMPLETED_LEVELS, COVERAGE, FIELDS, GROUPS, LANGUAGE_LEVELS, LANGUAGES, SCHOLARSHIP_MODES, TARGET_LEVELS, TESTS } from "../matching/model.js";
import { STUDY_LEVELS } from "../lib/validation.js";
import type { DiscoverySource } from "./sources.js";

/**
 * Extração: o Claude pesquisa e lê SÓ os sites oficiais da fonte (web_search/web_fetch com allowed_domains) e devolve
 * as bolsas em JSON (saída estruturada). Quem decide o que é publicado é publish.ts, com validação própria.
 */

export const MODEL = "claude-opus-5-5";
/** Preços do modelo (USD por milhão de tokens) e da busca (por pesquisa), para o teto de gasto. */
const PRICE = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5, perSearch: 0.01 };

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

const SYSTEM = `Você coleta bolsas de estudo REAIS para uma plataforma gratuita que ajuda estudantes lusófonos (Moçambique, Angola, Cabo Verde, Guiné-Bissau, São Tomé e Príncipe, Brasil, Timor-Leste) a encontrar bolsas.

Regras:
- Use só informação das páginas oficiais que você pesquisar e abrir. Nunca invente dados; se algo não estiver na página, deixe vazio, lista vazia ou null.
- Inclua apenas bolsas com candidaturas abertas agora ou com abertura anunciada para os próximos 12 meses e com prazo conhecido (data exata).
- Inclua apenas bolsas que estudantes de pelo menos um país lusófono possam pedir (ou abertas a qualquer nacionalidade).
- Prazos: o do ciclo atual ou do próximo; copie o trecho do edital que mostra a data em deadlineEvidence.
- Textos (título, resumo, cobertura, requisitos, documentos, processo) em português, claros e curtos.
- Critérios (match) em códigos. Nacionalidades: códigos ISO 3166-1 alfa-2 ou os grupos @AFRICA, @CPLP, @COMMONWEALTH. Nota mínima em % da escala.
- No máximo 15 bolsas por fonte. Se não achar nenhuma que cumpra as regras, devolva a lista vazia e explique em notes.`;

export type Usage = { inputTokens: number; outputTokens: number; searches: number; fetches: number; costUsd: number };
export const emptyUsage = (): Usage => ({ inputTokens: 0, outputTokens: 0, searches: 0, fetches: 0, costUsd: 0 });

export function addUsage(total: Usage, u: Anthropic.Beta.BetaUsage | null | undefined): Usage {
  if (!u) return total;
  const input = u.input_tokens ?? 0, output = u.output_tokens ?? 0;
  const cacheRead = u.cache_read_input_tokens ?? 0, cacheWrite = u.cache_creation_input_tokens ?? 0;
  const searches = u.server_tool_use?.web_search_requests ?? 0, fetches = u.server_tool_use?.web_fetch_requests ?? 0;
  const cost = (input * PRICE.input + output * PRICE.output + cacheRead * PRICE.cacheRead + cacheWrite * PRICE.cacheWrite) / 1_000_000 + searches * PRICE.perSearch;
  return {
    inputTokens: total.inputTokens + input + cacheRead + cacheWrite,
    outputTokens: total.outputTokens + output,
    searches: total.searches + searches,
    fetches: total.fetches + fetches,
    costUsd: total.costUsd + cost
  };
}

/** Uma chamada à API. Injetável para os testes (sem rede, sem custo). */
export type SendMessage = (params: Anthropic.Beta.MessageCreateParamsNonStreaming) => Promise<Anthropic.Beta.BetaMessage>;

export function realSender(client: Anthropic): SendMessage {
  // Em fluxo (streaming): turnos com busca e leitura de páginas podem passar de vários minutos.
  return (params) => client.beta.messages.stream(params).finalMessage();
}

export type ExtractResult = { scholarships: ExtractedScholarship[]; notes: string; usage: Usage; problem?: string };

export async function extractFromSource(
  send: SendMessage,
  source: DiscoverySource,
  known: { id: string; title: string }[],
  today: string
): Promise<ExtractResult> {
  const user = [
    `Fonte: ${source.name}`,
    `Sites oficiais permitidos: ${source.domains.join(", ")}`,
    `O que procurar: ${source.hint}`,
    `Data de hoje: ${today}.`,
    known.length > 0 ? `Bolsas desta fonte que já temos (reutilize a programKey, a parte depois de "${source.id}-", se for a mesma bolsa):\n${known.map((k) => `- ${k.id}: ${k.title}`).join("\n")}` : "Ainda não temos bolsas desta fonte.",
    "Pesquise, abra as páginas dos editais e devolva o JSON."
  ].join("\n\n");

  const params: Anthropic.Beta.MessageCreateParamsNonStreaming = {
    model: MODEL,
    max_tokens: 32000,
    system: SYSTEM,
    output_config: { effort: "medium", format: { type: "json_schema", schema: EXTRACTION_SCHEMA } },
    tools: [
      { type: "web_search_20260209", name: "web_search", max_uses: 4, allowed_domains: source.domains },
      { type: "web_fetch_20260209", name: "web_fetch", max_uses: 6, allowed_domains: source.domains, max_content_tokens: 20000 }
    ],
    // Se o modelo recusar por política (raro neste uso), a API tenta outro modelo na mesma chamada.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    messages: [{ role: "user", content: user }]
  };

  let usage = emptyUsage();
  let messages = params.messages;
  for (let turn = 0; turn < 6; turn += 1) {
    const response = await send({ ...params, messages });
    usage = addUsage(usage, response.usage);
    if (response.stop_reason === "pause_turn") {
      // Turno longo de busca: devolve o que veio e a API continua de onde parou (sem mensagem nova).
      messages = [...params.messages, { role: "assistant", content: response.content }];
      continue;
    }
    if (response.stop_reason === "refusal") return { scholarships: [], notes: "", usage, problem: "recusa do modelo" };
    if (response.stop_reason === "max_tokens") return { scholarships: [], notes: "", usage, problem: "resposta cortada (max_tokens)" };
    const text = response.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("");
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return { scholarships: [], notes: "", usage, problem: "resposta não é JSON" };
    }
    const parsed = extracted.safeParse(json);
    if (!parsed.success) return { scholarships: [], notes: "", usage, problem: "JSON fora do formato" };
    return { scholarships: parsed.data.scholarships, notes: parsed.data.notes, usage };
  }
  return { scholarships: [], notes: "", usage, problem: "busca não terminou (muitas pausas)" };
}
