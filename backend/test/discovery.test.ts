import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { scholarships } from "../src/db/schema.js";
import type { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import { claudeResearcher, extractFromSource, type SendMessage } from "../src/discovery/claude.js";
import { geminiResearcher } from "../src/discovery/gemini.js";
import type { ExtractedScholarship } from "../src/discovery/schema.js";
import { decide, publish, scholarshipId } from "../src/discovery/publish.js";
import { runDiscovery } from "../src/discovery/run.js";
import { isOfficialUrl, sourcesForWeek, SOURCES, type DiscoverySource } from "../src/discovery/sources.js";
import { setupTestApp } from "./helpers.js";

const TODAY = new Date("2026-11-25T12:00:00Z");
const SOURCE: DiscoverySource = { id: "chevening", name: "Chevening", domains: ["chevening.org"], hint: "teste" };

const item = (over: Partial<ExtractedScholarship> = {}): ExtractedScholarship => ({
  programKey: "chevening-mestrado", title: "Bolsa Chevening de Mestrado", institution: "Governo do Reino Unido", country: "Reino Unido",
  level: "Mestrado", fundingType: "Integral", funding: "Propinas, subsídio mensal, passagens.", deadline: "2027-02-10",
  deadlineEvidence: "Applications close 10 February 2027", summary: "Mestrado de um ano no Reino Unido.", requirements: ["Licenciatura", "2 anos de experiência"],
  requiredDocuments: ["Diploma", "Cartas de referência"], applicationProcess: "Candidatura online.", sourceUrl: "https://www.chevening.org/scholarships/",
  match: {
    levels: ["master"], fields: [], eligibleNationalities: ["MZ", "AO", "BR"], destinations: ["GB"], coverage: ["tuition", "living", "travel"],
    languages: [{ code: "en", minLevel: "B2" }], tests: [], minGpaPercent: null, requiredCompletedLevel: "bachelor", maxAge: null, minWorkYears: 2,
    restrictedTo: [], applicationFee: false, studyMode: "onsite"
  },
  ...over
});

/** Resposta da API simulada. */
const message = (stop: Anthropic.Beta.BetaStopReason, content: unknown[], usage: Partial<Anthropic.Beta.BetaUsage> = {}) =>
  ({ id: "m", type: "message", role: "assistant", model: "claude-opus-5-5", stop_reason: stop, content, usage: { input_tokens: 1000, output_tokens: 500, ...usage } }) as unknown as Anthropic.Beta.BetaMessage;
const jsonReply = (data: unknown, usage?: Partial<Anthropic.Beta.BetaUsage>) => message("end_turn", [{ type: "text", text: JSON.stringify(data) }], usage);

describe("fontes", () => {
  it("todas têm id válido, domínio e dica; ids únicos", () => {
    const ids = SOURCES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SOURCES) {
      expect(s.id).toMatch(/^[a-z0-9-]+$/);
      expect(s.domains.length).toBeGreaterThan(0);
      for (const d of s.domains) expect(d).toMatch(/^[a-z0-9.-]+\.[a-z]+$/);
    }
  });

  it("só aceita https no domínio oficial ou subdomínio", () => {
    expect(isOfficialUrl("https://www.chevening.org/apply", SOURCE)).toBe(true);
    expect(isOfficialUrl("https://chevening.org", SOURCE)).toBe(true);
    expect(isOfficialUrl("http://www.chevening.org/apply", SOURCE)).toBe(false);
    expect(isOfficialUrl("https://chevening.org.golpe.com/x", SOURCE)).toBe(false);
    expect(isOfficialUrl("https://bolsas-chevening.blogspot.com", SOURCE)).toBe(false);
    expect(isOfficialUrl("não é url", SOURCE)).toBe(false);
  });

  it("rodízio: duas semanas seguidas cobrem todas as fontes, sem repetir", () => {
    const a = sourcesForWeek(TODAY), b = sourcesForWeek(new Date(TODAY.getTime() + 7 * 86_400_000));
    expect([...a, ...b].map((s) => s.id).sort()).toEqual(SOURCES.map((s) => s.id).sort());
  });
});

describe("decidir o que publicar", () => {
  it("bolsa boa vira o formato do importador, não verificada, com id estável", () => {
    const d = decide(SOURCE, item(), TODAY);
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.input).toMatchObject({ id: "chevening-mestrado", verification: { status: "unverified" }, match: { minWorkYears: 2, eligibleNationalities: ["MZ", "AO", "BR"] } });
    expect(scholarshipId(SOURCE, "Chevening – Mestrado 2027!")).toBe("chevening-mestrado-2027");
  });

  it("recusa link de outro site, prazo ausente, vencido, iminente ou distante", () => {
    const reason = (over: Partial<ExtractedScholarship>) => { const d = decide(SOURCE, item(over), TODAY); return d.ok ? "ok" : d.reason; };
    expect(reason({ sourceUrl: "https://bolsasdeestudo.blog/chevening" })).toMatch(/fora do site oficial/);
    expect(reason({ deadline: "" })).toMatch(/sem prazo/);
    expect(reason({ deadline: "2026-10-01" })).toMatch(/vencido/);
    expect(reason({ deadline: "2026-11-26" })).toMatch(/menos de 3 dias/);
    expect(reason({ deadline: "2029-01-01" })).toMatch(/distante/);
  });

  it("recusa bolsa que não aceita nenhum país lusófono; aceita grupo que inclui um (ou qualquer nacionalidade)", () => {
    const reason = (nat: string[]) => { const d = decide(SOURCE, item({ match: { ...item().match, eligibleNationalities: nat } }), TODAY); return d.ok ? "ok" : d.reason; };
    expect(reason(["KE", "NG"])).toMatch(/lusófono/);
    expect(reason(["@COMMONWEALTH"])).toBe("ok"); // Moçambique é da Commonwealth
    expect(reason([])).toBe("ok");
  });

  it("dados fora do formato (nível, código de país, área inventada) não passam", () => {
    expect(decide(SOURCE, item({ level: "Pós-doc" }), TODAY)).toMatchObject({ ok: false, reason: expect.stringMatching(/^formato: level/) });
    expect(decide(SOURCE, item({ match: { ...item().match, eligibleNationalities: ["MOZ"] } }), TODAY)).toMatchObject({ ok: false });
    expect(decide(SOURCE, item({ match: { ...item().match, fields: ["astrologia"] } }), TODAY)).toMatchObject({ ok: false });
  });
});

describe("extração com o Claude (simulado)", () => {
  it("restringe busca e leitura aos domínios da fonte, continua depois de pause_turn e soma o gasto", async () => {
    const calls: Anthropic.Beta.MessageCreateParamsNonStreaming[] = [];
    const replies = [
      message("pause_turn", [{ type: "server_tool_use", id: "s1", name: "web_search", input: { query: "chevening" } }], { server_tool_use: { web_search_requests: 2, web_fetch_requests: 0 } } as never),
      jsonReply({ scholarships: [item()], notes: "ok" }, { server_tool_use: { web_search_requests: 1, web_fetch_requests: 3 } } as never)
    ];
    const send: SendMessage = async (p) => { calls.push(p); return replies.shift()!; };
    const out = await extractFromSource(send, SOURCE, [{ id: "chevening-mestrado", title: "Chevening" }], "2026-11-25");
    expect(out.problem).toBeUndefined();
    expect(out.scholarships).toHaveLength(1);
    expect(calls).toHaveLength(2);
    const tools = calls[0]!.tools as { name: string; allowed_domains?: string[] }[];
    expect(tools.map((t) => [t.name, t.allowed_domains])).toEqual([["web_search", ["chevening.org"]], ["web_fetch", ["chevening.org"]]]);
    expect(calls[0]!.model).toBe("claude-opus-5-5");
    expect(JSON.stringify(calls[0]!.messages)).toContain("chevening-mestrado");
    // Depois da pausa: mesma pergunta + o turno do assistente, sem mensagem nova do usuário.
    expect(calls[1]!.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(out.usage).toMatchObject({ searches: 3, fetches: 3, inputTokens: 2000, outputTokens: 1000 });
    expect(out.usage.costUsd).toBeCloseTo((2000 * 4 + 1000 * 20) / 1e6 + 0.03, 6);
  });

  it("recusa, resposta cortada ou JSON inválido viram 'problema' (nada é publicado)", async () => {
    const once = (m: Anthropic.Beta.BetaMessage): SendMessage => async () => m;
    expect((await extractFromSource(once(message("refusal", [])), SOURCE, [], "2026-11-25")).problem).toMatch(/recusa/);
    expect((await extractFromSource(once(message("max_tokens", [])), SOURCE, [], "2026-11-25")).problem).toMatch(/cortada/);
    expect((await extractFromSource(once(message("end_turn", [{ type: "text", text: "{nope" }])), SOURCE, [], "2026-11-25")).problem).toMatch(/não é JSON/);
    expect((await extractFromSource(once(jsonReply({ outra: 1 })), SOURCE, [], "2026-11-25")).problem).toMatch(/fora do formato/);
  });
});

describe("motor Gemini (simulado)", () => {
  const reply = (text: string, usage = { promptTokenCount: 800, candidatesTokenCount: 200, toolUsePromptTokenCount: 5000 }) =>
    ({ text, usageMetadata: usage }) as unknown as GenerateContentResponse;
  const noWait = { delayMs: 0, sleep: async () => {} };

  it("1ª chamada pesquisa com Google e leitura de páginas; 2ª converte em JSON com esquema, sem ferramentas", async () => {
    const calls: GenerateContentParameters[] = [];
    const replies = [reply("Bolsa Chevening: prazo 10/02/2027 (https://www.chevening.org/scholarships/) ..."), reply(JSON.stringify({ scholarships: [item()], notes: "" }))];
    const research = geminiResearcher(async (p) => { calls.push(p); return replies.shift()!; }, { ...noWait, model: "gemini-teste" });
    const out = await research(SOURCE, [], "2026-11-25");
    expect(out.problem).toBeUndefined();
    expect(out.scholarships).toHaveLength(1);
    expect(calls.map((c) => c.model)).toEqual(["gemini-teste", "gemini-teste"]);
    expect(calls[0]!.config?.tools).toEqual([{ googleSearch: {} }, { urlContext: {} }]);
    expect(String(calls[0]!.contents)).toContain("site:chevening.org");
    expect(calls[1]!.config?.tools).toBeUndefined();
    expect(calls[1]!.config).toMatchObject({ responseMimeType: "application/json" });
    expect(calls[1]!.config?.responseJsonSchema).toBeDefined();
    expect(String(calls[1]!.contents)).toContain("Bolsa Chevening: prazo 10/02/2027");
    expect(out.usage).toMatchObject({ requests: 2, inputTokens: 11600, outputTokens: 400, costUsd: 0 });
  });

  it("pesquisa vazia ou JSON inválido viram 'problema'; aceita JSON dentro de ```json", async () => {
    const once = (...texts: string[]) => geminiResearcher(async () => reply(texts.shift()!), noWait);
    expect((await once("")(SOURCE, [], "2026-11-25")).problem).toMatch(/não devolveu texto/);
    expect((await once("notas", "{nope")(SOURCE, [], "2026-11-25")).problem).toMatch(/não é JSON/);
    const fenced = await once("notas", "```json\n" + JSON.stringify({ scholarships: [], notes: "nenhuma aberta" }) + "\n```")(SOURCE, [], "2026-11-25");
    expect(fenced).toMatchObject({ scholarships: [], notes: "nenhuma aberta" });
    expect(fenced.problem).toBeUndefined();
  });

  it("limite do nível gratuito (429): espera e tenta de novo; outros erros sobem na hora", async () => {
    const sleeps: number[] = [];
    let n = 0;
    const research = geminiResearcher(async () => {
      n += 1;
      if (n === 1) throw Object.assign(new Error("429 RESOURCE_EXHAUSTED"), { status: 429 });
      return reply(n === 2 ? "notas" : JSON.stringify({ scholarships: [], notes: "" }));
    }, { delayMs: 0, sleep: async (ms) => { sleeps.push(ms); } });
    expect((await research(SOURCE, [], "2026-11-25")).problem).toBeUndefined();
    expect(sleeps).toContain(30_000);
    const broken = geminiResearcher(async () => { throw new Error("chave inválida"); }, noWait);
    await expect(broken(SOURCE, [], "2026-11-25")).rejects.toThrow("chave inválida");
  });
});

describe("gravar (com PostgreSQL)", () => {
  let t: Awaited<ReturnType<typeof setupTestApp>>;
  beforeAll(async () => { t = await setupTestApp(); });
  afterAll(async () => { await t.close(); });
  beforeEach(async () => { await t.reset(); });

  it("cria como 'busca automática', não verificada, e atualiza na próxima execução", async () => {
    expect(await publish(t.db, SOURCE, [item()], TODAY, false)).toEqual([{ id: "chevening-mestrado", title: "Bolsa Chevening de Mestrado", action: "created" }]);
    const res = await t.call("/scholarships/chevening-mestrado", { cookie: null });
    expect(res.json).toMatchObject({ origin: "discovery", status: "active", verification: { status: "unverified" }, sourceUrl: "https://www.chevening.org/scholarships/" });
    const again = await publish(t.db, SOURCE, [item({ deadline: "2027-02-20" })], TODAY, false);
    expect(again[0]!.action).toBe("updated");
    expect((await t.call("/scholarships/chevening-mestrado", { cookie: null })).json.deadline).toBe("2027-02-20");
  });

  it("ensaio (--dry-run) não grava nada", async () => {
    expect((await publish(t.db, SOURCE, [item()], TODAY, true))[0]!.action).toBe("created");
    expect((await t.call("/scholarships/chevening-mestrado", { cookie: null })).status).toBe(404);
  });

  it("nunca mexe em bolsa verificada, cadastrada à mão ou ocultada por um admin; reativa a que só tinha vencido", async () => {
    await publish(t.db, SOURCE, [item()], TODAY, false);
    await t.db.update(scholarships).set({ verificationStatus: "verified" }).where(eq(scholarships.id, "chevening-mestrado"));
    expect((await publish(t.db, SOURCE, [item({ title: "Outro título" })], TODAY, false))[0]).toMatchObject({ action: "skipped", reason: expect.stringMatching(/verificada/) });

    await t.db.update(scholarships).set({ verificationStatus: "unverified", status: "hidden", hiddenReason: "Edital suspenso pelo governo" }).where(eq(scholarships.id, "chevening-mestrado"));
    expect((await publish(t.db, SOURCE, [item()], TODAY, false))[0]).toMatchObject({ action: "skipped", reason: expect.stringMatching(/admin/) });

    await t.db.update(scholarships).set({ hiddenReason: "deadline_passed" }).where(eq(scholarships.id, "chevening-mestrado"));
    expect((await publish(t.db, SOURCE, [item()], TODAY, false))[0]!.action).toBe("updated");
    expect((await t.call("/scholarships/chevening-mestrado", { cookie: null })).json.status).toBe("active");

    const demo: DiscoverySource = { id: "amostra", name: "x", domains: ["chevening.org"], hint: "" };
    expect((await publish(t.db, demo, [item({ programKey: "001" })], TODAY, false))[0]).toMatchObject({ action: "skipped", reason: expect.stringMatching(/à mão/) });
  });

  it("execução com o Gemini: para no teto de chamadas", async () => {
    const sources: DiscoverySource[] = ["g-a", "g-b", "g-c"].map((id) => ({ id, name: id, domains: ["chevening.org"], hint: "" }));
    const research = geminiResearcher(async (p) => ({ text: p.config?.tools ? "notas" : JSON.stringify({ scholarships: [], notes: "" }), usageMetadata: {} }) as unknown as GenerateContentResponse, { delayMs: 0, sleep: async () => {} });
    const report = await runDiscovery(t.db, research, { sources, maxUsd: 5, maxRequests: 4, dryRun: true, today: TODAY, log: () => {} });
    expect(report.perSource.map((p) => p.source)).toEqual(["g-a", "g-b"]);
    expect(report.stoppedForBudget).toBe(true);
    expect(report.usage.requests).toBe(4);
  });

  it("execução: para no teto de gasto e uma fonte com erro não derruba as outras", async () => {
    const sources: DiscoverySource[] = [
      { id: "fonte-a", name: "A", domains: ["chevening.org"], hint: "" },
      { id: "fonte-b", name: "B", domains: ["chevening.org"], hint: "" },
      { id: "fonte-c", name: "C", domains: ["chevening.org"], hint: "" }
    ];
    let n = 0;
    const send: SendMessage = async () => {
      n += 1;
      if (n === 1) throw new Error("rede caiu");
      return jsonReply({ scholarships: [item({ programKey: `p${n}` })], notes: "" }, { input_tokens: 100_000, output_tokens: 10_000 });
    };
    const lines: string[] = [];
    const report = await runDiscovery(t.db, claudeResearcher(send), { sources, maxUsd: 1.1, costPerSource: 0.6, dryRun: false, today: TODAY, log: (l) => lines.push(l) });
    expect(report.perSource.map((p) => [p.source, p.problem ?? "ok"])).toEqual([["fonte-a", "rede caiu"], ["fonte-b", "ok"]]);
    expect(report.stoppedForBudget).toBe(true);
    expect(report.usage.costUsd).toBeCloseTo(0.6, 5);
    expect((await t.call("/scholarships/fonte-b-p2", { cookie: null })).status).toBe(200);
  });
});
