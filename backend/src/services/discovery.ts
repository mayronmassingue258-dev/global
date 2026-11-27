import { and, desc, eq, gt, lt, sql } from "drizzle-orm";
import type { Config } from "../config.js";
import type { Database } from "../db/client.js";
import { discoveryRuns } from "../db/schema.js";
import { HttpError, validationFailed } from "../lib/errors.js";
import type { StudentProfile } from "../matching/model.js";
import { PROFILE_SOURCE_ID, profileReady, profileSource } from "../discovery/profile.js";
import { runDiscovery, summarize } from "../discovery/run.js";
import type { Researcher } from "../discovery/schema.js";
import { SOURCES, sourcesForWeek, type DiscoverySource } from "../discovery/sources.js";

/**
 * Busca automática disparada pelo painel de administração, rodando DENTRO da API (no Render, sem serviço extra).
 * O pedido responde na hora (202) e a busca continua em segundo plano; o painel acompanha pelo registro da execução.
 */

export type Engine = { provider: string; research: Researcher; costPerSource: number; model?: string };
/** Monta o motor de busca a partir da configuração, ou diz o que falta. Injetável nos testes. */
export type EngineFactory = () => Promise<Engine | { missing: string }>;

let geminiModel: string | undefined;

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
    const { geminiResearcher, realGenerate, pickGeminiModel, GEMINI_API_VERSION } = await import("../discovery/gemini.js");
    const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY, apiVersion: GEMINI_API_VERSION });
    // Escolhido uma vez por processo (a lista de modelos da chave muda raramente).
    geminiModel ??= config.GEMINI_MODEL ?? (await pickGeminiModel(ai));
    return { provider: "gemini", model: geminiModel, research: geminiResearcher(realGenerate(ai), { model: geminiModel }), costPerSource: 0 };
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

async function isRunning(db: Database) {
  await closeStale(db);
  const [running] = await db.select({ id: discoveryRuns.id }).from(discoveryRuns)
    .where(and(eq(discoveryRuns.status, "running"), gt(discoveryRuns.startedAt, new Date(Date.now() - STALE_MS)))).limit(1);
  return Boolean(running);
}

async function readyEngine(engineFactory: EngineFactory): Promise<Engine> {
  const engine = await engineFactory();
  if ("missing" in engine) throw new HttpError(409, "discovery_not_configured", { [engine.missing]: "required" });
  return engine;
}

/**
 * Começa uma execução pedida pelo painel. Devolve o registro já criado e a promessa do fim (os testes esperam por ela;
 * a rota não). Só uma execução por vez.
 */
export async function startDiscovery(db: Database, config: Config, engineFactory: EngineFactory, userId: string, input: StartInput) {
  const engine = await readyEngine(engineFactory);
  if (await isRunning(db)) throw new HttpError(409, "discovery_running");
  const sources = input.sources === "all" ? SOURCES : input.sources === "week" ? sourcesForWeek(new Date()) : SOURCES.filter((s) => (input.sources as string[]).includes(s.id));
  return launch(db, config, engine, userId, input.dryRun, sources);
}

const DAY_MS = 86_400_000;
let lastAutoCheck = 0;

/**
 * Busca automática SEM admin: chamada quando um estudante usa as recomendações. Se a última busca completa tiver mais
 * de DISCOVERY_AUTO_DAYS dias, roda o rodízio da semana em segundo plano. Consulta a base no máximo a cada 10 minutos.
 */
export async function maybeAutoRun(db: Database, config: Config, engineFactory: EngineFactory, now = Date.now()) {
  if (config.DISCOVERY_AUTO_DAYS === 0 || now - lastAutoCheck < 10 * 60_000) return null;
  lastAutoCheck = now;
  const engine = await engineFactory();
  if ("missing" in engine || (await isRunning(db))) return null;
  const [last] = await db.select({ startedAt: discoveryRuns.startedAt }).from(discoveryRuns)
    .where(and(eq(discoveryRuns.dryRun, false), sql`not (${discoveryRuns.sources} @> array[${PROFILE_SOURCE_ID}]::text[])`))
    .orderBy(desc(discoveryRuns.startedAt)).limit(1);
  if (last && now - last.startedAt.getTime() < config.DISCOVERY_AUTO_DAYS * DAY_MS) return null;
  return launch(db, config, engine, null, false, sourcesForWeek(new Date(now)));
}

/** Só para testes: libera a próxima verificação da busca automática. */
export function __resetAutoCheck() {
  lastAutoCheck = 0;
}

/**
 * "Procurar novas bolsas para mim": busca aberta na web guiada pelo perfil do estudante. Publica (com os mesmos
 * filtros) para todos. Limites: 1 por estudante a cada 24 h e DISCOVERY_STUDENT_DAILY no total por dia.
 */
export async function startProfileSearch(db: Database, config: Config, engineFactory: EngineFactory, userId: string, profile: StudentProfile) {
  if (!profileReady(profile)) throw validationFailed({ profile: "incomplete" });
  const engine = await readyEngine(engineFactory);
  const since = new Date(Date.now() - DAY_MS);
  const isProfileRun = sql`${discoveryRuns.sources} @> array[${PROFILE_SOURCE_ID}]::text[]`;
  const [mine] = await db.select({ id: discoveryRuns.id }).from(discoveryRuns)
    .where(and(isProfileRun, eq(discoveryRuns.startedBy, userId), gt(discoveryRuns.startedAt, since))).limit(1);
  if (mine) throw new HttpError(429, "search_limit_user");
  const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`count(*)::int` }).from(discoveryRuns).where(and(isProfileRun, gt(discoveryRuns.startedAt, since)));
  if (n >= config.DISCOVERY_STUDENT_DAILY) throw new HttpError(429, "search_limit_daily");
  if (await isRunning(db)) throw new HttpError(409, "discovery_running");
  return launch(db, config, engine, userId, false, [profileSource(profile)]);
}

/** A busca pelo perfil mais recente deste estudante (para a tela "Para você" acompanhar). */
export async function latestProfileSearch(db: Database, userId: string) {
  const [row] = await db.select().from(discoveryRuns)
    .where(and(sql`${discoveryRuns.sources} @> array[${PROFILE_SOURCE_ID}]::text[]`, eq(discoveryRuns.startedBy, userId)))
    .orderBy(desc(discoveryRuns.startedAt)).limit(1);
  if (!row) return null;
  const run = toRun(row);
  return { id: run.id, status: run.status, startedAt: run.startedAt, ...(run.finishedAt ? { finishedAt: run.finishedAt } : {}), ...(run.summary ? { summary: { created: run.summary.created ?? 0, updated: run.summary.updated ?? 0 } } : {}) };
}

async function launch(db: Database, config: Config, engine: Engine, userId: string | null, dryRun: boolean, sources: DiscoverySource[]) {
  const input = { dryRun };
  const [row] = await db.insert(discoveryRuns).values({ dryRun, provider: engine.provider, sources: sources.map((s) => s.id), startedBy: userId }).returning();
  const runId = row!.id;

  const lines: string[] = [`Motor: ${engine.provider}${engine.model ? ` (modelo ${engine.model})` : ""}.${userId ? "" : " Busca automática (sem admin)."}`];
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
