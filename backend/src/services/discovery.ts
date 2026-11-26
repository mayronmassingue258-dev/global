import { and, desc, eq, gt, lt, sql } from "drizzle-orm";
import type { Config } from "../config.js";
import type { Database } from "../db/client.js";
import { discoveryRuns } from "../db/schema.js";
import { HttpError, validationFailed } from "../lib/errors.js";
import { runDiscovery, summarize } from "../discovery/run.js";
import type { Researcher } from "../discovery/schema.js";
import { SOURCES, sourcesForWeek } from "../discovery/sources.js";

/**
 * Busca automática disparada pelo painel de administração, rodando DENTRO da API (no Render, sem serviço extra).
 * O pedido responde na hora (202) e a busca continua em segundo plano; o painel acompanha pelo registro da execução.
 */

export type Engine = { provider: string; research: Researcher; costPerSource: number };
/** Monta o motor de busca a partir da configuração, ou diz o que falta. Injetável nos testes. */
export type EngineFactory = () => Promise<Engine | { missing: string }>;

export function engineFromConfig(config: Config): EngineFactory {
  return async () => {
    if (config.DISCOVERY_PROVIDER === "claude") {
      if (!config.ANTHROPIC_API_KEY) return { missing: "ANTHROPIC_API_KEY" };
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const { claudeResearcher, realSender, CLAUDE_COST_PER_SOURCE } = await import("../discovery/claude.js");
      return { provider: "claude", research: claudeResearcher(realSender(new Anthropic({ apiKey: config.ANTHROPIC_API_KEY }))), costPerSource: CLAUDE_COST_PER_SOURCE };
    }
    if (!config.GEMINI_API_KEY) return { missing: "GEMINI_API_KEY" };
    const { GoogleGenAI } = await import("@google/genai");
    const { geminiResearcher, realGenerate } = await import("../discovery/gemini.js");
    return { provider: "gemini", research: geminiResearcher(realGenerate(new GoogleGenAI({ apiKey: config.GEMINI_API_KEY })), { model: config.GEMINI_MODEL }), costPerSource: 0 };
  };
}

/** Uma execução "rodando" há mais que isto morreu no meio (o servidor reiniciou ou adormeceu). */
const STALE_MS = 2 * 60 * 60 * 1000;
const LOG_MAX = 200_000;

type StartInput = { dryRun: boolean; sources: "week" | "all" | string[] };

export function parseStart(body: unknown): StartInput {
  const b = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const fields: Record<string, string> = {};
  if (typeof b.dryRun !== "boolean") fields.dryRun = b.dryRun === undefined ? "required" : "invalid_type";
  const sources = b.sources ?? "week";
  const valid = sources === "week" || sources === "all" ||
    (Array.isArray(sources) && sources.length > 0 && sources.length <= SOURCES.length && sources.every((id) => typeof id === "string" && SOURCES.some((s) => s.id === id)));
  if (!valid) fields.sources = "invalid_option";
  if (Object.keys(fields).length > 0) throw validationFailed(fields);
  return { dryRun: b.dryRun as boolean, sources: sources as StartInput["sources"] };
}

const toRun = (r: typeof discoveryRuns.$inferSelect, withLog = false) => ({
  id: r.id,
  status: r.status as "running" | "done" | "failed",
  dryRun: r.dryRun,
  provider: r.provider,
  sources: r.sources,
  startedAt: r.startedAt.toISOString(),
  ...(r.finishedAt ? { finishedAt: r.finishedAt.toISOString() } : {}),
  ...(r.summary ? { summary: r.summary } : {}),
  ...(withLog ? { log: r.log } : {})
});

async function closeStale(db: Database) {
  await db.update(discoveryRuns)
    .set({ status: "failed", finishedAt: new Date(), log: sql`${discoveryRuns.log} || ${"\n(interrompida: o servidor reiniciou ou adormeceu no meio da busca)"}` })
    .where(and(eq(discoveryRuns.status, "running"), lt(discoveryRuns.startedAt, new Date(Date.now() - STALE_MS))));
}

/**
 * Começa uma execução. Devolve o registro já criado e a promessa do fim (os testes esperam por ela; a rota não).
 * Só uma execução por vez.
 */
export async function startDiscovery(db: Database, config: Config, engineFactory: EngineFactory, userId: string, input: StartInput) {
  const engine = await engineFactory();
  if ("missing" in engine) throw new HttpError(409, "discovery_not_configured", { [engine.missing]: "required" });
  await closeStale(db);
  const [running] = await db.select({ id: discoveryRuns.id }).from(discoveryRuns)
    .where(and(eq(discoveryRuns.status, "running"), gt(discoveryRuns.startedAt, new Date(Date.now() - STALE_MS)))).limit(1);
  if (running) throw new HttpError(409, "discovery_running");

  const sources = input.sources === "all" ? SOURCES : input.sources === "week" ? sourcesForWeek(new Date()) : SOURCES.filter((s) => (input.sources as string[]).includes(s.id));
  const [row] = await db.insert(discoveryRuns).values({ dryRun: input.dryRun, provider: engine.provider, sources: sources.map((s) => s.id), startedBy: userId }).returning();
  const runId = row!.id;

  const lines: string[] = [];
  let flushed = 0;
  /** Grava o registro aos poucos (o painel mostra o andamento). */
  const flush = async () => {
    if (lines.length === flushed) return;
    flushed = lines.length;
    await db.update(discoveryRuns).set({ log: lines.join("\n").slice(-LOG_MAX) }).where(eq(discoveryRuns.id, runId));
  };
  const timer = setInterval(() => void flush().catch(() => {}), 5_000);
  timer.unref();

  const done = (async () => {
    try {
      const report = await runDiscovery(db, engine.research, {
        sources, dryRun: input.dryRun, maxUsd: config.DISCOVERY_MAX_USD, maxRequests: config.DISCOVERY_MAX_REQUESTS,
        costPerSource: engine.costPerSource, log: (line) => lines.push(line)
      });
      lines.push(summarize(report, input.dryRun));
      const all = report.perSource.flatMap((p) => p.outcomes);
      const summary = {
        created: all.filter((o) => o.action === "created").length,
        updated: all.filter((o) => o.action === "updated").length,
        skipped: all.filter((o) => o.action === "skipped").length,
        requests: report.usage.requests,
        costUsd: Math.round(report.usage.costUsd * 100) / 100,
        stoppedForBudget: report.stoppedForBudget,
        problems: report.perSource.filter((p) => p.problem).map((p) => `${p.source}: ${p.problem}`)
      };
      const failed = report.perSource.length > 0 && report.perSource.every((p) => p.problem);
      clearInterval(timer);
      await db.update(discoveryRuns).set({ status: failed ? "failed" : "done", finishedAt: new Date(), summary, log: lines.join("\n").slice(-LOG_MAX) }).where(eq(discoveryRuns.id, runId));
    } catch (error) {
      clearInterval(timer);
      lines.push(`Erro: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
      await db.update(discoveryRuns).set({ status: "failed", finishedAt: new Date(), log: lines.join("\n").slice(-LOG_MAX) }).where(eq(discoveryRuns.id, runId)).catch(() => {});
    }
  })();
  return { run: toRun(row!), done };
}

export async function listDiscoveryRuns(db: Database, config: Config) {
  await closeStale(db);
  const rows = await db.select().from(discoveryRuns).orderBy(desc(discoveryRuns.startedAt)).limit(10);
  const configured = config.DISCOVERY_PROVIDER === "claude" ? Boolean(config.ANTHROPIC_API_KEY) : Boolean(config.GEMINI_API_KEY);
  return {
    provider: config.DISCOVERY_PROVIDER,
    configured,
    sources: SOURCES.map((s) => ({ id: s.id, name: s.name })),
    weekSources: sourcesForWeek(new Date()).map((s) => s.id),
    items: rows.map((r) => toRun(r))
  };
}

export async function getDiscoveryRun(db: Database, id: number) {
  const [row] = await db.select().from(discoveryRuns).where(eq(discoveryRuns.id, id)).limit(1);
  return row ? toRun(row, true) : null;
}
