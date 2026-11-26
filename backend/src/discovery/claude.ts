import type Anthropic from "@anthropic-ai/sdk";
import { EXTRACTION_SCHEMA, SYSTEM, emptyUsage, parseExtraction, userPrompt, type ExtractResult, type Researcher, type Usage } from "./schema.js";
import type { DiscoverySource } from "./sources.js";

/**
 * Motor Claude (opcional; o padrão é o Gemini, ver gemini.ts). O Claude pesquisa e lê SÓ os sites oficiais da fonte (web_search/web_fetch com allowed_domains) e devolve
 * as bolsas em JSON (saída estruturada). Quem decide o que é publicado é publish.ts, com validação própria.
 */

export const MODEL = "claude-opus-5-5";
/** Preços do modelo (USD por milhão de tokens) e da busca (por pesquisa), para o teto de gasto. */
const PRICE = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5, perSearch: 0.01 };

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
    requests: total.requests + 1,
    costUsd: total.costUsd + cost
  };
}

/** Uma chamada à API. Injetável para os testes (sem rede, sem custo). */
export type SendMessage = (params: Anthropic.Beta.MessageCreateParamsNonStreaming) => Promise<Anthropic.Beta.BetaMessage>;

/** Estimativa por fonte (USD), usada para não começar uma fonte que passaria do teto. */
export const CLAUDE_COST_PER_SOURCE = 0.6;

export function claudeResearcher(send: SendMessage): Researcher {
  return (source, known, today) => extractFromSource(send, source, known, today);
}

export function realSender(client: Anthropic): SendMessage {
  // Em fluxo (streaming): turnos com busca e leitura de páginas podem passar de vários minutos.
  return (params) => client.beta.messages.stream(params).finalMessage();
}

export async function extractFromSource(
  send: SendMessage,
  source: DiscoverySource,
  known: { id: string; title: string }[],
  today: string
): Promise<ExtractResult> {
  const user = userPrompt(source, known, today);
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
    return { ...parseExtraction(text), usage };
  }
  return { scholarships: [], notes: "", usage, problem: "busca não terminou (muitas pausas)" };
}
