import { inArray, like } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { scholarships } from "../db/schema.js";
import { scholarshipInput, upsertScholarship, type ScholarshipInput } from "../db/import-scholarships.js";
import { expandCountries, COUNTRY_GROUPS } from "../matching/countries.js";
import type { ExtractedScholarship } from "./extract.js";
import { isOfficialUrl, type DiscoverySource } from "./sources.js";

/**
 * Filtros de publicação. As bolsas encontradas entram no ar como "não verificadas" SÓ se passarem em tudo:
 * link do edital no site oficial da fonte, prazo real e aberto (de 3 dias a 2 anos), serve para algum país lusófono,
 * dados no formato da plataforma (mesma validação do importador). E nunca sobrescrevem o trabalho de um admin.
 */

const LUSOPHONE = new Set<string>(COUNTRY_GROUPS["@CPLP"]);
const AUTO_HIDDEN = new Set(["deadline_passed", "criteria_missing"]);
const DAY = 86_400_000;

export type Decision = { ok: true; input: ScholarshipInput } | { ok: false; reason: string };

const slug = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function scholarshipId(source: DiscoverySource, programKey: string): string {
  const key = slug(programKey).replace(new RegExp(`^${source.id}-`), "") || "bolsa";
  return `${source.id}-${key}`.slice(0, 64).replace(/-+$/, "");
}

/** Decide se uma bolsa extraída pode ser publicada, e a converte para o formato do importador. */
export function decide(source: DiscoverySource, s: ExtractedScholarship, today: Date): Decision {
  if (!isOfficialUrl(s.sourceUrl, source)) return { ok: false, reason: `link fora do site oficial (${s.sourceUrl || "vazio"})` };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.deadline)) return { ok: false, reason: "sem prazo exato" };
  const deadline = Date.parse(`${s.deadline}T23:59:59Z`);
  if (Number.isNaN(deadline)) return { ok: false, reason: "prazo inválido" };
  if (deadline < today.getTime() + 3 * DAY) return { ok: false, reason: `prazo vencido ou em menos de 3 dias (${s.deadline})` };
  if (deadline > today.getTime() + 730 * DAY) return { ok: false, reason: `prazo distante demais (${s.deadline})` };

  const groups = Array.isArray(s.match.eligibleNationalities)
    ? (s.match.eligibleNationalities as unknown[]).filter((x): x is string => typeof x === "string").map((x) => x.trim().toUpperCase())
    : [];
  if (groups.length > 0 && ![...expandCountries(groups)].some((c) => LUSOPHONE.has(c))) return { ok: false, reason: "não aceita nenhum país lusófono" };

  const candidate = {
    id: scholarshipId(source, s.programKey || s.title),
    title: s.title.trim(),
    institution: s.institution.trim(),
    country: s.country.trim(),
    level: s.level,
    fundingType: s.fundingType,
    funding: s.funding.trim(),
    deadline: s.deadline,
    summary: s.summary.trim(),
    requirements: s.requirements.map((r) => r.trim()).filter(Boolean).slice(0, 50),
    requiredDocuments: s.requiredDocuments.map((r) => r.trim()).filter(Boolean).slice(0, 50),
    ...(s.applicationProcess.trim() ? { applicationProcess: s.applicationProcess.trim() } : {}),
    sourceUrl: s.sourceUrl,
    verification: { status: "unverified" as const },
    match: { ...s.match, eligibleNationalities: groups }
  };
  const parsed = scholarshipInput.safeParse(candidate);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    return { ok: false, reason: `formato: ${issue.path.join(".")} ${issue.message}` };
  }
  return { ok: true, input: parsed.data };
}

export type PublishOutcome = { id: string; title: string; action: "created" | "updated" | "skipped"; reason?: string };

/**
 * Grava as bolsas aprovadas. Uma bolsa já existente só é atualizada se ainda for da busca automática, não verificada
 * e não tiver sido ocultada por um admin ou por relatos (essas ficam como estão até um admin decidir).
 */
export async function publish(db: Database, source: DiscoverySource, items: ExtractedScholarship[], today: Date, dryRun: boolean): Promise<PublishOutcome[]> {
  const outcomes: PublishOutcome[] = [];
  const approved: ScholarshipInput[] = [];
  for (const item of items) {
    const decision = decide(source, item, today);
    if (!decision.ok) outcomes.push({ id: scholarshipId(source, item.programKey || item.title), title: item.title, action: "skipped", reason: decision.reason });
    else if (approved.some((a) => a.id === decision.input.id)) outcomes.push({ id: decision.input.id, title: item.title, action: "skipped", reason: "repetida nesta busca" });
    else approved.push(decision.input);
  }
  if (approved.length === 0) return outcomes;

  const existing = await db.select({ id: scholarships.id, origin: scholarships.origin, verification: scholarships.verificationStatus, status: scholarships.status, hiddenReason: scholarships.hiddenReason })
    .from(scholarships).where(inArray(scholarships.id, approved.map((a) => a.id)));
  const byId = new Map(existing.map((e) => [e.id, e]));

  for (const input of approved) {
    const current = byId.get(input.id);
    if (current && current.origin !== "discovery") { outcomes.push({ id: input.id, title: input.title, action: "skipped", reason: "cadastrada à mão: não mexer" }); continue; }
    if (current && current.verification === "verified") { outcomes.push({ id: input.id, title: input.title, action: "skipped", reason: "já verificada por um admin" }); continue; }
    // Oculta por prazo vencido ou falta de critérios: a busca pode reativá-la com o ciclo novo. Por qualquer outro
    // motivo (um admin ocultou, estudantes reportaram), só um admin decide.
    if (current && current.status === "hidden" && !AUTO_HIDDEN.has(current.hiddenReason ?? "")) {
      outcomes.push({ id: input.id, title: input.title, action: "skipped", reason: "ocultada por um admin ou por relatos" });
      continue;
    }
    if (!dryRun) await upsertScholarship(db, input, "discovery");
    outcomes.push({ id: input.id, title: input.title, action: current ? "updated" : "created" });
  }
  return outcomes;
}

/** Bolsas desta fonte que já existem (para o Claude reutilizar as chaves e não duplicar). */
export async function knownForSource(db: Database, source: DiscoverySource) {
  return db.select({ id: scholarships.id, title: scholarships.title }).from(scholarships)
    .where(like(scholarships.id, `${source.id}-%`)).limit(40);
}
