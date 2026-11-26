import type { GenerateContentParameters, GenerateContentResponse, GoogleGenAI } from "@google/genai";
import { EXTRACTION_SCHEMA, SYSTEM, emptyUsage, parseExtraction, userPrompt, type Researcher, type Usage } from "./schema.js";

/**
 * Motor Gemini (padrão): usa a API do Gemini, que tem nível gratuito.
 *
 * Duas chamadas por fonte:
 *  1. PESQUISA: o Gemini pesquisa no Google e abre as páginas dos editais (ferramentas googleSearch e urlContext)
 *     e escreve anotações com os dados e os links oficiais.
 *  2. ESTRUTURA: sem ferramentas, converte as anotações no JSON da plataforma (resposta com esquema).
 *
 * No Gemini a pesquisa não pode ser restrita a domínios: a garantia de "só sites oficiais" é o filtro de publicação
 * (publish.ts recusa qualquer bolsa cujo link não seja do site oficial da fonte).
 */

/** Apelido do Google que sempre aponta para o modelo Flash mais recente (troque com GEMINI_MODEL). */
export const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";

/** Uma chamada à API. Injetável para os testes (sem rede, sem custo). */
export type Generate = (params: GenerateContentParameters) => Promise<GenerateContentResponse>;

export function realGenerate(ai: GoogleGenAI): Generate {
  return (params) => ai.models.generateContent(params);
}

type Options = { model?: string; delayMs?: number; sleep?: (ms: number) => Promise<void>; retries?: number };

const isRateLimited = (error: unknown) => {
  const status = (error as { status?: number; code?: number } | null)?.status ?? (error as { code?: number } | null)?.code;
  return status === 429 || /429|RESOURCE_EXHAUSTED|rate limit/i.test(error instanceof Error ? error.message : String(error));
};

function addUsage(total: Usage, response: GenerateContentResponse): Usage {
  const u = response.usageMetadata;
  return {
    ...total,
    inputTokens: total.inputTokens + (u?.promptTokenCount ?? 0) + (u?.toolUsePromptTokenCount ?? 0),
    outputTokens: total.outputTokens + (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0),
    requests: total.requests + 1
    // costUsd: 0 no nível gratuito. Com faturamento ativado no Google, o gasto aparece no painel do Google AI Studio.
  };
}

export function geminiResearcher(generate: Generate, { model = DEFAULT_GEMINI_MODEL, delayMs = 6000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), retries = 3 }: Options = {}): Researcher {
  /** Chama a API respeitando o limite por minuto do nível gratuito (pausa entre chamadas; espera e repete em 429). */
  const call = async (params: GenerateContentParameters) => {
    for (let attempt = 0; ; attempt += 1) {
      try {
        const response = await generate(params);
        await sleep(delayMs);
        return response;
      } catch (error) {
        if (!isRateLimited(error) || attempt >= retries) throw error;
        await sleep(30_000 * (attempt + 1));
      }
    }
  };

  return async (source, known, today) => {
    let usage = emptyUsage();

    // 1) Pesquisa e leitura das páginas.
    const research = await call({
      model,
      contents: `${userPrompt(source, known, today)}

Nesta etapa, NÃO escreva JSON. Escreva anotações em português, uma bolsa por bloco, com: nome, instituição, país de estudo, níveis,
áreas, nacionalidades aceitas, o que cobre, prazo exato (e o trecho do edital com a data), requisitos, documentos, idiomas e testes,
nota mínima, idade máxima, experiência, taxa de candidatura, modalidade e o ENDEREÇO EXATO da página oficial de onde veio cada dado.`,
      config: { systemInstruction: SYSTEM, tools: [{ googleSearch: {} }, { urlContext: {} }] }
    });
    usage = addUsage(usage, research);
    const notes = research.text?.trim() ?? "";
    if (!notes) return { scholarships: [], notes: "", usage, problem: "a pesquisa não devolveu texto" };

    // 2) Estrutura: anotações → JSON no formato da plataforma (sem ferramentas, com esquema).
    const structured = await call({
      model,
      contents: `Converta as anotações abaixo no JSON pedido. Use SÓ o que está nelas (não acrescente nada). Data de hoje: ${today}.
Bolsa sem prazo exato, sem link oficial de ${source.domains.join(" ou ")}, ou que nenhum país lusófono possa pedir: deixe de fora.

ANOTAÇÕES:
${notes}`,
      config: { systemInstruction: SYSTEM, responseMimeType: "application/json", responseJsonSchema: EXTRACTION_SCHEMA }
    });
    usage = addUsage(usage, structured);
    return { ...parseExtraction(structured.text ?? ""), usage };
  };
}
