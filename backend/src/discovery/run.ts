import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { loadConfig } from "../config.js";
import { createDb, type Database } from "../db/client.js";
import { hideExpired } from "../services/scholarships.js";
import { emptyUsage, extractFromSource, realSender, type SendMessage, type Usage } from "./extract.js";
import { knownForSource, publish, type PublishOutcome } from "./publish.js";
import { SOURCES, sourcesForWeek, type DiscoverySource } from "./sources.js";

/**
 * Busca de bolsas reais nas fontes oficiais.
 *
 *   npm run discovery -- --dry-run              # pesquisa e mostra o que publicaria, sem gravar
 *   npm run discovery                           # metade das fontes (rodízio semanal), grava
 *   npm run discovery -- --all                  # todas as fontes
 *   npm run discovery -- --only=chevening,daad  # só estas
 *   npm run discovery -- --max-usd=3            # teto de gasto desta execução (padrão: DISCOVERY_MAX_USD ou 5)
 *
 * Precisa de ANTHROPIC_API_KEY e DATABASE_URL (backend/.env ou variáveis de ambiente; no GitHub, segredos).
 */

export type RunOptions = { sources: DiscoverySource[]; maxUsd: number; dryRun: boolean; today?: Date; log?: (line: string) => void };
export type RunReport = { usage: Usage; perSource: { source: string; outcomes: PublishOutcome[]; notes: string; problem?: string }[]; stoppedForBudget: boolean };

export async function runDiscovery(db: Database, send: SendMessage, { sources, maxUsd, dryRun, today = new Date(), log = console.log }: RunOptions): Promise<RunReport> {
  let usage = emptyUsage();
  const perSource: RunReport["perSource"] = [];
  let stoppedForBudget = false;
  const day = today.toISOString().slice(0, 10);

  for (const source of sources) {
    // Uma fonte custa em média ~0,30–0,60 USD: só começa outra se ainda houver folga no teto.
    if (usage.costUsd + 0.6 > maxUsd) {
      stoppedForBudget = true;
      log(`Teto de ${maxUsd.toFixed(2)} USD alcançado: as demais fontes ficam para a próxima execução.`);
      break;
    }
    log(`\n▶ ${source.name}`);
    let result;
    try {
      result = await extractFromSource(send, source, await knownForSource(db, source), day);
    } catch (error) {
      // Erro de rede ou da API numa fonte não derruba as outras.
      const message = error instanceof Error ? error.message.split("\n")[0]! : String(error);
      log(`  ✗ falhou: ${message}`);
      perSource.push({ source: source.id, outcomes: [], notes: "", problem: message });
      continue;
    }
    usage = {
      inputTokens: usage.inputTokens + result.usage.inputTokens, outputTokens: usage.outputTokens + result.usage.outputTokens,
      searches: usage.searches + result.usage.searches, fetches: usage.fetches + result.usage.fetches, costUsd: usage.costUsd + result.usage.costUsd
    };
    if (result.problem) log(`  ✗ ${result.problem}`);
    const outcomes = await publish(db, source, result.scholarships, today, dryRun);
    for (const o of outcomes) log(`  ${o.action === "skipped" ? "–" : "✓"} ${o.action === "created" ? "nova" : o.action === "updated" ? "atualizada" : "ignorada"}: ${o.title}${o.reason ? ` (${o.reason})` : ""}`);
    if (result.notes) log(`  notas: ${result.notes}`);
    log(`  gasto até aqui: ${usage.costUsd.toFixed(2)} USD (${usage.searches} pesquisas, ${usage.fetches} páginas)`);
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
    `  gasto: ${report.usage.costUsd.toFixed(2)} USD (${report.usage.inputTokens} tokens lidos, ${report.usage.outputTokens} escritos, ${report.usage.searches} pesquisas)`
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
  return { sources, maxUsd, dryRun: argv.includes("--dry-run") };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    process.loadEnvFile(new URL("../../.env", import.meta.url));
  } catch {
    // sem .env
  }
  const options = parseArgs(process.argv.slice(2));
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.error("Falta ANTHROPIC_API_KEY (chave da API do Claude). No GitHub: Settings → Secrets → Actions.");
    process.exit(1);
  }
  const config = loadConfig();
  const { db, sql } = createDb(config.DATABASE_URL, { ssl: config.DATABASE_SSL === "require", prepare: config.DATABASE_PREPARE === "1", max: 1 });
  console.log(`Busca de bolsas: ${options.sources.length} fonte(s), teto ${options.maxUsd.toFixed(2)} USD${options.dryRun ? ", ENSAIO (não grava)" : ""}.`);
  const report = await runDiscovery(db, realSender(new Anthropic()), options);
  await sql.end();
  console.log(summarize(report, options.dryRun));
  process.exit(report.perSource.length > 0 && report.perSource.every((p) => p.problem) ? 1 : 0);
}
