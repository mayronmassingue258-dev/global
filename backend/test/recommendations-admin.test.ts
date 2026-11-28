import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { scholarships } from "../src/db/schema.js";
import { setRole } from "../src/db/grant-admin.js";
import { hideExpired } from "../src/services/scholarships.js";
import { __resetAutoCheck } from "../src/services/discovery.js";
import { discoveryRuns } from "../src/db/schema.js";
import { setupTestApp } from "./helpers.js";

let t: Awaited<ReturnType<typeof setupTestApp>>;
beforeAll(async () => { t = await setupTestApp(); });
afterAll(async () => { await t.close(); });
beforeEach(async () => { await t.reset(); });

const example = JSON.parse(readFileSync(new URL("../scholarships.example.json", import.meta.url), "utf8"))[0];
const { id: _exampleId, ...exampleBody } = example;
const ids = (items: { scholarship: { id: string } }[]) => items.map((i) => i.scholarship.id);

/** Perfil de uma estudante moçambicana de engenharia que quer mestrado. */
const mozambican = {
  nationalities: ["MZ"], residenceCountry: "MZ", completedLevel: "bachelor", targetLevels: ["master"], fields: ["computer_science"],
  gpa: { value: 16, scale: "20" }, languages: [{ code: "pt", level: "native" }, { code: "en", level: "C1" }], tests: [{ type: "ielts", score: 7 }],
  fundingNeed: "full", canPayApplicationFee: false, birthYear: 2000, workYears: 1, studyMode: "onsite", startYear: new Date().getUTCFullYear() + 1
};

describe("recomendações", () => {
  it("exige login e valida o limite", async () => {
    expect((await t.call("/recommendations", { cookie: null })).status).toBe(401);
    await t.signUpAndUse();
    expect((await t.call("/recommendations?limit=0")).status).toBe(400);
    expect((await t.call("/recommendations?limit=abc")).json.error.fields).toEqual({ limit: "out_of_range" });
  });

  it("perfil vazio: recebe bolsas em aberto, com o que falta informar", async () => {
    await t.signUpAndUse();
    const { status, json } = await t.call("/recommendations");
    expect(status).toBe(200);
    expect(json.considered).toBeGreaterThan(0);
    expect(json.items.length).toBeGreaterThan(0);
    for (const item of json.items) expect(item.eligibility).toBe("possible");
  });

  it("perfil completo: elimina o que não serve, ordena pela nota e explica cada uma", async () => {
    await t.signUpAndUse();
    await t.call("/profile", { method: "PUT", body: mozambican });
    const { json } = await t.call("/recommendations");
    const got = ids(json.items);
    // amostra-001: mestrado no Reino Unido, CPLP/Commonwealth, integral, ciência de dados → a melhor.
    expect(got[0]).toBe("amostra-001");
    expect(json.items[0]).toMatchObject({ eligibility: "eligible", fit: "high", saved: false });
    expect(json.items[0].reasons).toContainEqual({ kind: "met", code: "nationality_ok" });
    // Eliminadas: doutorado (002), graduação (003), só europeus (004), curso livre (005), parcial com 2 anos de experiência (006).
    for (const id of ["amostra-002", "amostra-003", "amostra-004", "amostra-005", "amostra-006"]) expect(got).not.toContain(id);
    expect(json.excluded).toBe(json.considered - got.length);
    const scores = json.items.map((i: { score: number }) => i.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it("marca as já salvas, respeita o limite e ignora ocultas e vencidas", async () => {
    await t.signUpAndUse();
    await t.call("/applications", { method: "POST", body: { scholarshipId: "amostra-001" } });
    expect((await t.call("/recommendations")).json.items.find((i: { scholarship: { id: string } }) => i.scholarship.id === "amostra-001").saved).toBe(true);
    expect((await t.call("/recommendations?limit=2")).json.items).toHaveLength(2);

    await t.db.update(scholarships).set({ status: "hidden" }).where(eq(scholarships.id, "amostra-001"));
    await t.db.update(scholarships).set({ deadline: "2020-01-01" }).where(eq(scholarships.id, "amostra-003"));
    const got = ids((await t.call("/recommendations")).json.items);
    expect(got).not.toContain("amostra-001");
    expect(got).not.toContain("amostra-003");
  });

  it("bolsas com prazo vencido saem da busca pública", async () => {
    await t.db.update(scholarships).set({ deadline: "2020-01-01" }).where(eq(scholarships.id, "amostra-003"));
    expect(await hideExpired(t.db)).toBe(1);
    const list = (await t.call("/scholarships", { cookie: null })).json;
    expect(list.items.map((s: { id: string }) => s.id)).not.toContain("amostra-003");
    // O detalhe continua acessível (quem já salvou a bolsa vê o aviso), marcado como oculto.
    expect((await t.call("/scholarships/amostra-003", { cookie: null })).json).toMatchObject({ status: "hidden" });
  });
});

describe("reportar erro", () => {
  it("valida, exige login e 404 para bolsa inexistente", async () => {
    expect((await t.call("/scholarships/amostra-001/reports", { method: "POST", body: { reason: "closed" }, cookie: null })).status).toBe(401);
    await t.signUpAndUse();
    expect((await t.call("/scholarships/amostra-001/reports", { method: "POST", body: { reason: "porque sim" } })).json.error.fields).toEqual({ reason: "invalid_option" });
    expect((await t.call("/scholarships/amostra-001/reports", { method: "POST", body: { reason: "other", message: "x".repeat(1001) } })).json.error.fields).toEqual({ message: "too_long" });
    expect((await t.call("/scholarships/nao-existe/reports", { method: "POST", body: { reason: "closed" } })).status).toBe(404);
    expect((await t.call("/scholarships/amostra-001/reports", { method: "POST", body: { reason: "broken_link", message: "O link dá 404" } })).status).toBe(204);
  });

  it("3 estudantes diferentes com motivo grave tiram a bolsa do ar; o mesmo estudante repetindo, não", async () => {
    const one = await t.signUp("um@exemplo.com");
    for (let i = 0; i < 5; i++) await t.call("/scholarships/amostra-001/reports", { method: "POST", body: { reason: "closed" }, cookie: one });
    expect((await t.call("/scholarships/amostra-001", { cookie: null })).json.status).toBe("active");

    const two = await t.signUp("dois@exemplo.com");
    const three = await t.signUp("tres@exemplo.com");
    await t.call("/scholarships/amostra-001/reports", { method: "POST", body: { reason: "wrong_info" }, cookie: two });
    await t.call("/scholarships/amostra-001/reports", { method: "POST", body: { reason: "scam" }, cookie: three });
    expect((await t.call("/scholarships/amostra-001", { cookie: null })).json.status).toBe("active"); // "wrong_info" não é grave

    await t.call("/scholarships/amostra-001/reports", { method: "POST", body: { reason: "broken_link" }, cookie: two });
    expect((await t.call("/scholarships/amostra-001", { cookie: null })).json.status).toBe("hidden");
  });
});

describe("administração", () => {
  const becomeAdmin = async (email = "admin@exemplo.com") => {
    const cookie = await t.signUp(email);
    await setRole(t.db, email, "admin");
    return cookie;
  };

  it("estudante comum recebe 403; sem login, 401; admin vê o próprio papel em /auth/me", async () => {
    expect((await t.call("/admin/scholarships", { cookie: null })).status).toBe(401);
    const student = await t.signUp("aluna@exemplo.com");
    expect((await t.call("/auth/me", { cookie: student })).json.user).not.toHaveProperty("role");
    for (const [method, path] of [["GET", "/admin/scholarships"], ["PATCH", "/admin/scholarships/amostra-001"], ["PUT", "/admin/scholarships/x"], ["GET", "/admin/scholarships/amostra-001/reports"]]) {
      const res = await t.call(path!, { method, body: method === "GET" ? undefined : {}, cookie: student });
      expect(res.status, `${method} ${path}`).toBe(403);
      expect(res.json.error.code).toBe("forbidden");
    }
    const admin = await becomeAdmin();
    expect((await t.call("/auth/me", { cookie: admin })).json.user.role).toBe("admin");
  });

  it("lista tudo (inclusive ocultas), com filtros e reportadas primeiro", async () => {
    const admin = await becomeAdmin();
    const student = await t.signUp("aluna@exemplo.com");
    await t.call("/scholarships/amostra-005/reports", { method: "POST", body: { reason: "wrong_deadline" }, cookie: student });
    await t.db.update(scholarships).set({ status: "hidden", hiddenReason: "deadline_passed" }).where(eq(scholarships.id, "amostra-003"));

    const all = (await t.call("/admin/scholarships", { cookie: admin })).json;
    expect(all.total).toBe(6);
    expect(all.items[0]).toMatchObject({ id: "amostra-005", openReports: 1 });
    expect((await t.call("/admin/scholarships?status=hidden", { cookie: admin })).json.items).toEqual([expect.objectContaining({ id: "amostra-003", hiddenReason: "deadline_passed" })]);
    expect((await t.call("/admin/scholarships?reported=1", { cookie: admin })).json.total).toBe(1);
    expect((await t.call("/admin/scholarships?search=idiomas", { cookie: admin })).json.items.map((s: { id: string }) => s.id)).toEqual(["amostra-005"]);
    expect((await t.call("/admin/scholarships?status=talvez", { cookie: admin })).status).toBe(400);

    expect((await t.call("/admin/scholarships/amostra-005/reports", { cookie: admin })).json.items).toEqual([
      expect.objectContaining({ reason: "wrong_deadline", reporter: "aluna@exemplo.com" })
    ]);
    expect((await t.call("/admin/scholarships/amostra-005/reports/resolve", { method: "POST", cookie: admin })).json).toEqual({ resolved: 1 });
    expect((await t.call("/admin/scholarships?reported=1", { cookie: admin })).json.total).toBe(0);
  });

  it("cadastra e edita uma bolsa inteira (201 / 200), com validação", async () => {
    const admin = await becomeAdmin();
    const created = await t.call("/admin/scholarships/bolsa-nova-2027", { method: "PUT", body: exampleBody, cookie: admin });
    expect(created.status).toBe(201);
    expect(created.json).toMatchObject({ id: "bolsa-nova-2027", status: "active", origin: "manual", match: { eligibleNationalities: ["MZ", "AO", "CV", "GW", "ST"] } });
    const edited = await t.call("/admin/scholarships/bolsa-nova-2027", { method: "PUT", body: { ...exampleBody, title: "Novo título" }, cookie: admin });
    expect(edited.status).toBe(200);
    expect(edited.json.title).toBe("Novo título");

    const bad = await t.call("/admin/scholarships/bolsa-ruim", { method: "PUT", body: { ...exampleBody, match: { levels: [] } }, cookie: admin });
    expect(bad.status).toBe(422);
    expect(bad.json.error.fields).toMatchObject({ "match.levels": "required" });
    expect((await t.call("/admin/scholarships/Com Espaco", { method: "PUT", body: exampleBody, cookie: admin })).status).toBe(422);
  });

  it("verifica, oculta e reativa", async () => {
    const admin = await becomeAdmin();
    const verified = (await t.call("/admin/scholarships/amostra-001", { method: "PATCH", body: { verification: "verified" }, cookie: admin })).json;
    expect(verified.verification).toEqual({ status: "verified", verifiedAt: new Date().toISOString().slice(0, 10) });
    expect(Date.parse(verified.lastCheckedAt)).not.toBeNaN();

    await t.call("/admin/scholarships/amostra-001", { method: "PATCH", body: { status: "hidden", hiddenReason: "Edital suspenso" }, cookie: admin });
    expect((await t.call("/scholarships", { cookie: null })).json.total).toBe(5);
    expect((await t.call("/admin/scholarships?status=hidden", { cookie: admin })).json.items[0]).toMatchObject({ id: "amostra-001", hiddenReason: "Edital suspenso" });

    await t.call("/admin/scholarships/amostra-001", { method: "PATCH", body: { status: "active" }, cookie: admin });
    expect((await t.call("/scholarships", { cookie: null })).json.total).toBe(6);

    expect((await t.call("/admin/scholarships/amostra-001", { method: "PATCH", body: {}, cookie: admin })).status).toBe(422);
    expect((await t.call("/admin/scholarships/nao-existe", { method: "PATCH", body: { status: "active" }, cookie: admin })).status).toBe(404);
  });
});

describe("busca automática pelo painel", () => {
  const item = JSON.parse(readFileSync(new URL("../scholarships.example.json", import.meta.url), "utf8"))[0];
  let d: Awaited<ReturnType<typeof setupTestApp>>;
  let release: () => void = () => {};
  beforeAll(async () => {
    d = await setupTestApp({
      discoveryEngine: async () => ({
        provider: "teste",
        costPerSource: 0,
        research: async (source) => {
          if (source.id === "fonte-lenta") await new Promise<void>((r) => { release = r; });
          return {
            scholarships: source.id === "gulbenkian" ? [{
              programKey: "palop-mestrado", title: "Bolsa Gulbenkian PALOP", institution: "Fundação Calouste Gulbenkian", country: "Portugal", level: "Mestrado",
              fundingType: "Integral", funding: "Propinas e subsídio.", deadline: new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10), deadlineEvidence: "x",
              summary: "Bolsa para estudantes dos PALOP.", requirements: [], requiredDocuments: [], applicationProcess: "", sourceUrl: "https://gulbenkian.pt/bolsas/",
              match: { ...item.match, eligibleNationalities: ["MZ"] }
            }] : [],
            notes: "",
            usage: { inputTokens: 10, outputTokens: 5, searches: 0, fetches: 0, requests: 2, costUsd: 0 }
          };
        }
      })
    });
  });
  afterAll(async () => { await d.close(); });
  beforeEach(async () => { await d.reset(); });

  const admin = async () => {
    const cookie = await d.signUp("admin@exemplo.com");
    await setRole(d.db, "admin@exemplo.com", "admin");
    return cookie;
  };
  const waitDone = async (cookie: string, runId: number) => {
    for (let i = 0; i < 50; i += 1) {
      const run = (await d.call(`/admin/discovery/runs/${runId}`, { cookie })).json;
      if (run.status !== "running") return run;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error("a busca não terminou");
  };

  it("só admin; mostra fontes, rodízio e se está configurada", async () => {
    const student = await d.signUp("aluna@exemplo.com");
    expect((await d.call("/admin/discovery", { cookie: student })).status).toBe(403);
    expect((await d.call("/admin/discovery/runs", { method: "POST", body: { dryRun: true }, cookie: student })).status).toBe(403);
    const cookie = await admin();
    const state = (await d.call("/admin/discovery", { cookie })).json;
    expect(state).toMatchObject({ provider: "gemini", configured: false, items: [] });
    expect(state.sources.length).toBeGreaterThan(10);
    expect(state.weekSources.length).toBeGreaterThan(0);
  });

  it("ensaio não grava; busca de verdade publica como não verificada e registra o resumo", async () => {
    const cookie = await admin();
    const dry = await d.call("/admin/discovery/runs", { method: "POST", body: { dryRun: true, sources: ["gulbenkian"] }, cookie });
    expect(dry.status).toBe(202);
    expect(dry.json).toMatchObject({ status: "running", dryRun: true, provider: "teste", sources: ["gulbenkian"] });
    const dryDone = await waitDone(cookie, dry.json.id);
    expect(dryDone).toMatchObject({ status: "done", summary: { created: 1, requests: 2 } });
    expect(dryDone.log).toContain("Bolsa Gulbenkian PALOP");
    expect(dryDone.log).toContain("ensaio");
    expect((await d.call("/scholarships/gulbenkian-palop-mestrado", { cookie: null })).status).toBe(404);

    const real = await d.call("/admin/discovery/runs", { method: "POST", body: { dryRun: false, sources: ["gulbenkian"] }, cookie });
    await waitDone(cookie, real.json.id);
    expect((await d.call("/scholarships/gulbenkian-palop-mestrado", { cookie: null })).json).toMatchObject({ origin: "discovery", verification: { status: "unverified" } });
    expect((await d.call("/admin/discovery", { cookie })).json.items.map((r: { id: number }) => r.id)).toEqual([real.json.id, dry.json.id]);
  });

  it("valida o pedido e não deixa duas buscas ao mesmo tempo", async () => {
    const cookie = await admin();
    expect((await d.call("/admin/discovery/runs", { method: "POST", body: {}, cookie })).json.error.fields).toEqual({ dryRun: "required" });
    expect((await d.call("/admin/discovery/runs", { method: "POST", body: { dryRun: true, sources: ["nao-existe"] }, cookie })).json.error.fields).toEqual({ sources: "invalid_option" });
    // Fonte lenta (só existe no teste): a 1ª execução fica rodando até liberarmos.
    const { SOURCES } = await import("../src/discovery/sources.js");
    SOURCES.push({ id: "fonte-lenta", name: "Lenta", domains: ["exemplo.org"], hint: "" });
    try {
      const first = await d.call("/admin/discovery/runs", { method: "POST", body: { dryRun: true, sources: ["fonte-lenta"] }, cookie });
      expect(first.status).toBe(202);
      const second = await d.call("/admin/discovery/runs", { method: "POST", body: { dryRun: true }, cookie });
      expect(second.status).toBe(409);
      expect(second.json.error.code).toBe("discovery_running");
      release();
      await waitDone(cookie, first.json.id);
    } finally {
      SOURCES.pop();
    }
  });

  it("sem a chave configurada: 409 discovery_not_configured", async () => {
    const plain = await setupTestApp();
    try {
      const cookie = await plain.signUp("admin2@exemplo.com");
      await setRole(plain.db, "admin2@exemplo.com", "admin");
      const res = await plain.call("/admin/discovery/runs", { method: "POST", body: { dryRun: true }, cookie });
      expect(res.status).toBe(409);
      expect(res.json.error).toMatchObject({ code: "discovery_not_configured", fields: { GEMINI_API_KEY: "required" } });
    } finally {
      await plain.close();
    }
  });
});

describe("busca sem admin", () => {
  let e: Awaited<ReturnType<typeof setupTestApp>>;
  const seen: string[] = [];
  beforeAll(async () => {
    e = await setupTestApp({
      env: { DISCOVERY_STUDENT_DAILY: "2" },
      discoveryEngine: async () => ({
        provider: "teste", costPerSource: 0,
        research: async (source) => {
          seen.push(source.id);
          return { scholarships: [], notes: "", usage: { inputTokens: 0, outputTokens: 0, searches: 0, fetches: 0, requests: 2, costUsd: 0 } };
        }
      })
    });
  });
  afterAll(async () => { await e.close(); });
  beforeEach(async () => { await e.reset(); seen.length = 0; __resetAutoCheck(); });

  const waitIdle = async () => {
    for (let i = 0; i < 50; i += 1) {
      const running = await e.db.select({ id: discoveryRuns.id }).from(discoveryRuns).where(eq(discoveryRuns.status, "running"));
      if (running.length === 0) return;
      await new Promise((r) => setTimeout(r, 30));
    }
  };
  const ready = { nationalities: ["MZ"], targetLevels: ["master"], fields: ["engineering"] };

  it("estudante pede a busca pelo perfil e acompanha; perfil incompleto é recusado", async () => {
    await e.signUpAndUse("ana@exemplo.com");
    expect((await e.call("/recommendations/search")).json).toEqual({ search: null });
    const incomplete = await e.call("/recommendations/search", { method: "POST" });
    expect(incomplete.status).toBe(422);
    expect(incomplete.json.error.fields).toEqual({ profile: "incomplete" });

    await e.call("/profile", { method: "PUT", body: ready });
    const started = await e.call("/recommendations/search", { method: "POST" });
    expect(started.status).toBe(202);
    expect(started.json.status).toBe("running");
    await waitIdle();
    expect(seen).toEqual(["web"]);
    expect((await e.call("/recommendations/search")).json.search).toMatchObject({ id: started.json.id, status: "done", summary: { created: 0, updated: 0 } });
  });

  it("limites: 1 por estudante por dia e um total diário", async () => {
    const ana = await e.signUp("ana@exemplo.com");
    await e.call("/profile", { method: "PUT", body: ready, cookie: ana });
    expect((await e.call("/recommendations/search", { method: "POST", cookie: ana })).status).toBe(202);
    await waitIdle();
    const again = await e.call("/recommendations/search", { method: "POST", cookie: ana });
    expect(again.status).toBe(429);
    expect(again.json.error.code).toBe("search_limit_user");

    const bia = await e.signUp("bia@exemplo.com");
    await e.call("/profile", { method: "PUT", body: ready, cookie: bia });
    expect((await e.call("/recommendations/search", { method: "POST", cookie: bia })).status).toBe(202);
    await waitIdle();
    const caio = await e.signUp("caio@exemplo.com");
    await e.call("/profile", { method: "PUT", body: ready, cookie: caio });
    const daily = await e.call("/recommendations/search", { method: "POST", cookie: caio });
    expect(daily.status).toBe(429);
    expect(daily.json.error.code).toBe("search_limit_daily");
  });

  it("ao abrir as recomendações, roda o rodízio semanal se a última busca for antiga (sem admin) — e não repete", async () => {
    await e.signUpAndUse("ana@exemplo.com");
    expect((await e.call("/recommendations")).status).toBe(200);
    // A busca começa logo depois da resposta (em segundo plano): espera ela aparecer e terminar.
    let runs = await e.db.select().from(discoveryRuns);
    for (let i = 0; i < 60 && !(runs.length > 0 && runs[0]!.status !== "running"); i += 1) {
      await new Promise((r) => setTimeout(r, 30));
      runs = await e.db.select().from(discoveryRuns);
    }
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ startedBy: null, dryRun: false, status: "done" });
    expect(seen.length).toBeGreaterThan(5);
    expect(runs[0]!.log).toContain("sem admin");

    __resetAutoCheck();
    await e.call("/recommendations");
    await waitIdle();
    expect(await e.db.select().from(discoveryRuns)).toHaveLength(1); // a última é recente: não roda de novo
  });
});
