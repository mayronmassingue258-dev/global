import { fileURLToPath } from "node:url";
import { loadConfig } from "../config.js";
import { createDb, type Database } from "../db/client.js";
import { hideExpired } from "../services/scholarships.js";
import { emptyUsage, sumUsage, type Researcher, type Usage } from "./schema.js";
import { knownForSource, publish, type PublishOutcome } from "./publish.js";
import { SOURCES, sourcesForWeek, type DiscoverySource } from "./sources.js";

/**
 * Busca de bolsas reais nas fontes oficiais. Motor: Gemini (padrão, nível gratuito, GEMINI_API_KEY) ou Claude
 * (DISCOVERY_PROVIDER=claude, ANTHROPIC_API_KEY).
 *
 *   npm run discovery -- --dry-run              # pesquisa e mostra o que publicaria, sem gravar
 *   npm run discovery                           # metade das fontes (rodízio semanal), grava
 *   npm run discovery -- --all                  # todas as fontes
 *   npm run discovery -- --only=chevening,daad  # só estas
 *   npm run discovery -- --max-usd=3            # teto de gasto desta execução (padrão: DISCOVERY_MAX_USD ou 5; só o Claude cobra)
 *   npm run discovery -- --max-requests=40      # teto de chamadas à API (padrão 40; protege a cota diária gratuita)
 *
 * Precisa de GEMINI_API_KEY (ou ANTHROPIC_API_KEY com DISCOVERY_PROVIDER=claude) e DATABASE_URL.
 */

export type RunOptions = {
  sources: DiscoverySource[]; maxUsd: number; dryRun: boolean; today?: Date; log?: (line: string) => void;
  /** Gasto estimado de uma fonte (USD): uma fonte só começa se couber no teto. 0 no nível gratuito do Gemini. */
  costPerSource?: number;
  maxRequests?: number;
};
export type RunReport = { usage: Usage; perSource: { source: string; outcomes: PublishOutcome[]; notes: string; problem?: string }[]; stoppedForBudget: boolean };

export async function runDiscovery(db: Database, research: Researcher, { sources, maxUsd, dryRun, today = new Date(), log = console.log, costPerSource = 0, maxRequests = 40 }: RunOptions): Promise<RunReport> {
  let usage = emptyUsage();
  const perSource: RunReport["perSource"] = [];
  let stoppedForBudget = false;
  const day = today.toISOString().slice(0, 10);

  for (const source of sources) {
    // Só começa outra fonte se ainda houver folga nos tetos (gasto e chamadas; o Gemini faz 2 chamadas por fonte).
    if (usage.costUsd + costPerSource > maxUsd || usage.requests + 2 > maxRequests) {
      stoppedForBudget = true;
      log(`Teto alcançado (${usage.costUsd.toFixed(2)} de ${maxUsd.toFixed(2)} USD, ${usage.requests} de ${maxRequests} chamadas): as demais fontes ficam para a próxima execução.`);
      break;
    }
    log(`\n▶ ${source.name}`);
    let result;
    try {
      result = await research(source, await knownForSource(db, source), day);
    } catch (error) {
      // Erro de rede ou da API numa fonte não derruba as outras.
      const message = error instanceof Error ? error.message.split("\n")[0]! : String(error);
      log(`  ✗ falhou: ${message}`);
      perSource.push({ source: source.id, outcomes: [], notes: "", problem: message });
      continue;
    }
    usage = sumUsage(usage, result.usage);
    if (result.problem) log(`  ✗ ${result.problem}`);
    const outcomes = await publish(db, source, result.scholarships, today, dryRun);
    for (const o of outcomes) log(`  ${o.action === "skipped" ? "–" : "✓"} ${o.action === "created" ? "nova" : o.action === "updated" ? "atualizada" : "ignorada"}: ${o.title}${o.reason ? ` (${o.reason})` : ""}`);
    if (result.notes) log(`  notas: ${result.notes}`);
    log(`  até aqui: ${usage.requests} chamadas, ${usage.costUsd.toFixed(2)} USD`);
    perSource.push({ source: source.id, outcomes, notes: result.notes, ...(result.problem ? { problem: result.problem } : {}) });
  }
  if (!dryRun) {
    const hidden = await hideExpired(db);
    if (hidden > 0) log(`\n${hidden} bolsa(s) com prazo vencido saíram do ar.`);
  }
  return { usage, perSource, stoppedForBudget };
}

export function summarize(report: RunReport, dryRun: boolean): string {
  const all = report.perSource.flatMap((p) => p.outcomes);
  const count = (a: PublishOutcome["action"]) => all.filter((o) => o.action === a).length;
  return [
    `\nResumo${dryRun ? " (ensaio: nada foi gravado)" : ""}:`,
    `  fontes: ${report.perSource.length}${report.stoppedForBudget ? " (parou no teto de gasto)" : ""}`,
    `  ${dryRun ? "seriam novas" : "novas"}: ${count("created")} · ${dryRun ? "seriam atualizadas" : "atualizadas"}: ${count("updated")} · ignoradas: ${count("skipped")}`,
    `  fontes com problema: ${report.perSource.filter((p) => p.problem).map((p) => p.source).join(", ") || "nenhuma"}`,
    `  uso: ${report.usage.requests} chamadas, ${report.usage.inputTokens} tokens lidos, ${report.usage.outputTokens} escritos, gasto estimado ${report.usage.costUsd.toFixed(2)} USD`
  ].join("\n");
}

function parseArgs(argv: string[]) {
  const value = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  const only = value("only")?.split(",").map((s) => s.trim()).filter(Boolean);
  const unknown = only?.filter((id) => !SOURCES.some((s) => s.id === id)) ?? [];
  if (unknown.length > 0) throw new Error(`Fonte(s) desconhecida(s): ${unknown.join(", ")}. Disponíveis: ${SOURCES.map((s) => s.id).join(", ")}`);
  const sources = only ? SOURCES.filter((s) => only.includes(s.id)) : argv.includes("--all") ? SOURCES : sourcesForWeek(new Date());
  const maxUsd = Number(value("max-usd") ?? process.env.DISCOVERY_MAX_USD ?? "5");
  if (!Number.isFinite(maxUsd) || maxUsd <= 0 || maxUsd > 50) throw new Error("--max-usd precisa ser um número entre 0 e 50.");
  const maxRequests = Number(value("max-requests") ?? process.env.DISCOVERY_MAX_REQUESTS ?? "40");
  if (!Number.isInteger(maxRequests) || maxRequests < 2 || maxRequests > 500) throw new Error("--max-requests precisa ser um inteiro entre 2 e 500.");
  return { sources, maxUsd, maxRequests, dryRun: argv.includes("--dry-run") };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    process.loadEnvFile(new URL("../../.env", import.meta.url));
  } catch {
    // sem .env
  }
  const options = parseArgs(process.argv.slice(2));
  const provider = (process.env.DISCOVERY_PROVIDER ?? "gemini").toLowerCase();
  let research: Researcher;
  let costPerSource = 0;
  if (provider === "claude") {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
      console.error("Falta ANTHROPIC_API_KEY (chave da API do Claude).");
      process.exit(1);
    }
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const { claudeResearcher, realSender, CLAUDE_COST_PER_SOURCE } = await import("./claude.js");
    research = claudeResearcher(realSender(new Anthropic()));
    costPerSource = CLAUDE_COST_PER_SOURCE;
  } else if (provider === "gemini") {
    if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
      console.error("Falta GEMINI_API_KEY (chave gratuita em aistudio.google.com → Get API key). No GitHub: Settings → Secrets → Actions.");
      process.exit(1);
    }
    const { GoogleGenAI } = await import("@google/genai");
    const { geminiResearcher, realGenerate, DEFAULT_GEMINI_MODEL } = await import("./gemini.js");
    research = geminiResearcher(realGenerate(new GoogleGenAI({})), { model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL });
  } else {
    console.error(`DISCOVERY_PROVIDER desconhecido: ${provider} (use gemini ou claude).`);
    process.exit(1);
  }
  const config = loadConfig();
  const { db, sql } = createDb(config.DATABASE_URL, { ssl: config.DATABASE_SSL === "require", prepare: config.DATABASE_PREPARE === "1", max: 1 });
  console.log(`Busca de bolsas (${provider}): ${options.sources.length} fonte(s), teto ${options.maxRequests} chamadas / ${options.maxUsd.toFixed(2)} USD${options.dryRun ? ", ENSAIO (não grava)" : ""}.`);
  const report = await runDiscovery(db, research, { ...options, costPerSource });
  await sql.end();
  console.log(summarize(report, options.dryRun));
  process.exit(report.perSource.length > 0 && report.perSource.every((p) => p.problem) ? 1 : 0);
}
