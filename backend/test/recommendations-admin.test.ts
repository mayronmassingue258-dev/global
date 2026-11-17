import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { scholarships } from "../src/db/schema.js";
import { setRole } from "../src/db/grant-admin.js";
import { hideExpired } from "../src/services/scholarships.js";
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
  fundingNeed: "full", canPayApplicationFee: false, birthYear: 2000, workYears: 1, studyMode: "onsite", startYear: 2027
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
