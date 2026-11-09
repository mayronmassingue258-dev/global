import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupTestApp } from "./helpers.js";

/**
 * Testes de CONTRATO (docs/api-contract.md): as mesmas regras verificadas na API local (mock-api/server.test.mjs),
 * agora contra o backend real e o PostgreSQL. Se o contrato mudar, os dois mudam juntos.
 */
let t: Awaited<ReturnType<typeof setupTestApp>>;
beforeAll(async () => { t = await setupTestApp(); });
afterAll(async () => { await t.close(); });
// Rotas de dados do estudante exigem login (B2): cada teste começa com uma conta nova e logada.
beforeEach(async () => {
  await t.reset();
  await t.signUpAndUse();
});

describe("bolsas", () => {
  it("lista com paginação e total", async () => {
    const { status, json } = await t.call("/scholarships?pageSize=2");
    expect(status).toBe(200);
    expect(json.items).toHaveLength(2);
    expect(json.total).toBe(6);
    expect(json.items.map((s: { deadline: string }) => s.deadline)).toEqual(["2026-12-03", "2027-01-28"]);
  });

  it("filtra por texto (sem diferenciar maiúsculas), país e nível, e ordena por título", async () => {
    expect((await t.call("/scholarships?search=DADOS")).json.items.map((s: { id: string }) => s.id)).toEqual(["amostra-001"]);
    expect((await t.call("/scholarships?country=reino")).json.total).toBe(2);
    const { json } = await t.call("/scholarships?level=Mestrado&sort=title");
    expect(json.items.every((s: { level: string }) => s.level === "Mestrado")).toBe(true);
    const titles = json.items.map((s: { title: string }) => s.title);
    expect(titles).toEqual([...titles].sort((a: string, b: string) => a.localeCompare(b, "pt-BR")));
  });

  it("busca não interpreta % e _ como curinga", async () => {
    expect((await t.call("/scholarships?search=%25")).json.total).toBe(0);
  });

  it("paginação estável e sem sobreposição", async () => {
    const p1 = (await t.call("/scholarships?pageSize=4&page=1")).json.items.map((s: { id: string }) => s.id);
    const p2 = (await t.call("/scholarships?pageSize=4&page=2")).json.items.map((s: { id: string }) => s.id);
    expect(p1).toHaveLength(4);
    expect(p2).toHaveLength(2);
    expect(new Set([...p1, ...p2]).size).toBe(6);
  });

  it("valida a query com 400 invalid_query", async () => {
    const { status, json } = await t.call("/scholarships?sort=price&pageSize=0");
    expect(status).toBe(400);
    expect(json.error).toMatchObject({ code: "invalid_query", fields: { sort: "invalid_option", pageSize: "out_of_range" } });
  });

  it("detalhe no formato do contrato e 404 no envelope de erro", async () => {
    const ok = await t.call("/scholarships/amostra-004");
    expect(ok.json).toMatchObject({ id: "amostra-004", eligibleCountries: ["Suíça", "Alemanha", "Áustria", "França", "Itália"], verification: { status: "unverified" } });
    expect(ok.json).not.toHaveProperty("sourceUrl");
    const missing = await t.call("/scholarships/nao-existe");
    expect(missing.status).toBe(404);
    expect(missing.json).toEqual({ error: { code: "not_found", message: "not_found" } });
  });
});

describe("perfil e elegibilidade", () => {
  it("perfil começa vazio (não 404) e valida com 422", async () => {
    const empty = await t.call("/profile");
    expect(empty.status).toBe(200);
    expect(empty.json).toEqual({ residence: "", nationality: "", level: "", field: "", grade: "", languages: "", interests: "" });
    const bad = await t.call("/profile", { method: "PUT", body: { residence: " ", level: "Mestrado", grade: 3 } });
    expect(bad.status).toBe(422);
    expect(bad.json.error.fields).toEqual({ residence: "required", grade: "invalid_type" });
  });

  it("salva com trim e devolve updatedAt", async () => {
    const { json } = await t.call("/profile", { method: "PUT", body: { residence: "  Moçambique ", level: "Mestrado", interests: "x".repeat(1000) } });
    expect(json).toMatchObject({ residence: "Moçambique", level: "Mestrado" });
    expect(Date.parse(json.updatedAt)).not.toBeNaN();
    expect((await t.call("/profile")).json.residence).toBe("Moçambique");
  });

  it("elegibilidade muda conforme o perfil salvo", async () => {
    expect((await t.call("/scholarships/amostra-004/eligibility")).json.status).toBe("possible");
    await t.call("/profile", { method: "PUT", body: { residence: "Moçambique", level: "Mestrado" } });
    const failed = (await t.call("/scholarships/amostra-004/eligibility")).json;
    expect(failed.status).toBe("not_eligible");
    expect(failed.reasons[0].text).toContain("fora da lista");
    await t.call("/profile", { method: "PUT", body: { residence: "suica", level: "Mestrado" } });
    expect((await t.call("/scholarships/amostra-004/eligibility")).json.status).toBe("eligible");
    expect((await t.call("/scholarships/nao-existe/eligibility")).status).toBe(404);
  });

  it("JSON inválido devolve 400 invalid_json", async () => {
    const res = await t.call("/profile", { method: "PUT", raw: "{nope" });
    expect(res.status).toBe(400);
    expect(res.json.error.code).toBe("invalid_json");
  });
});

describe("candidaturas", () => {
  it("cria (201) com checklist e linha do tempo, é idempotente (200), atualiza e remove", async () => {
    const created = await t.call("/applications", { method: "POST", body: { scholarshipId: "amostra-001" } });
    expect(created.status).toBe(201);
    expect(created.json).toMatchObject({
      id: "amostra-001",
      status: "Saved",
      notes: "",
      scholarship: { id: "amostra-001", title: "Bolsa de Mestrado em Ciência de Dados", institution: "Universidade Exemplo Internacional", deadline: "2027-02-15" },
      documents: [
        { name: "Diploma", done: false },
        { name: "Histórico acadêmico", done: false },
        { name: "Carta de motivação", done: false },
        { name: "Certificado de inglês", done: false }
      ]
    });
    expect(created.json.timeline.map((e: { kind: string }) => e.kind)).toEqual(["created"]);
    expect((await t.call("/applications", { method: "POST", body: { scholarshipId: "amostra-001" } })).status).toBe(200);

    const patched = await t.call("/applications/amostra-001", {
      method: "PATCH",
      body: { status: "Preparing", documents: [{ name: "Diploma", done: true }, { name: "Inexistente", done: true }], notes: "Pedir carta ao prof." }
    });
    expect(patched.status).toBe(200);
    expect(patched.json.documents[0]).toEqual({ name: "Diploma", done: true });
    expect(patched.json.timeline.map((e: { kind: string }) => e.kind)).toEqual(["created", "status", "document", "notes"]);
    expect(patched.json.timeline[1]).toMatchObject({ kind: "status", status: "Preparing" });
    expect(patched.json.timeline[2]).toMatchObject({ kind: "document", document: "Diploma", done: true });

    const again = await t.call("/applications/amostra-001", { method: "PATCH", body: { notes: "Pedir carta ao prof. Silva." } });
    expect(again.json.timeline).toHaveLength(4);
    const same = await t.call("/applications/amostra-001", { method: "PATCH", body: { status: "Preparing" } });
    expect(same.json.timeline).toHaveLength(4);

    expect((await t.call("/applications")).json.items).toHaveLength(1);
    expect((await t.call("/applications/amostra-001")).json.notes).toBe("Pedir carta ao prof. Silva.");
    expect((await t.call("/applications/amostra-001", { method: "DELETE" })).status).toBe(204);
    expect((await t.call("/applications/amostra-001", { method: "DELETE" })).status).toBe(404);
    expect((await t.call("/applications/amostra-001")).status).toBe(404);
  });

  it("valida criação e atualização", async () => {
    expect((await t.call("/applications", { method: "POST", body: { scholarshipId: "x" } })).json.error.fields).toEqual({ scholarshipId: "not_found" });
    expect((await t.call("/applications", { method: "POST", body: {} })).json.error.fields).toEqual({ scholarshipId: "required" });
    await t.call("/applications", { method: "POST", body: { scholarshipId: "amostra-001" } });
    expect((await t.call("/applications/amostra-001", { method: "PATCH", body: {} })).status).toBe(422);
    const bad = await t.call("/applications/amostra-001", { method: "PATCH", body: { status: "Won", notes: "x".repeat(5001), documents: "Diploma" } });
    expect(bad.json.error.fields).toEqual({ status: "invalid_option", notes: "too_long", documents: "invalid_type" });
    expect((await t.call("/applications/outra", { method: "PATCH", body: { status: "Saved" } })).status).toBe(404);
  });

  it("salvar várias bolsas ao mesmo tempo não perde nenhuma", async () => {
    const ids = ["amostra-001", "amostra-002", "amostra-003", "amostra-004", "amostra-005"];
    await Promise.all(ids.map((scholarshipId) => t.call("/applications", { method: "POST", body: { scholarshipId } })));
    expect((await t.call("/applications")).json.items).toHaveLength(5);
  });
});

describe("rascunhos", () => {
  const input = { type: "motivation_letter", title: "  Carta Mestrado  ", program: "Mestrado X", sections: { opening: "Olá" } };

  it("CRUD completo, mais recente primeiro", async () => {
    const created = await t.call("/drafts", { method: "POST", body: input });
    expect(created.status).toBe(201);
    expect(created.json).toMatchObject({ title: "Carta Mestrado", sections: { opening: "Olá" } });
    const id = created.json.id;
    const second = (await t.call("/drafts", { method: "POST", body: { ...input, title: "CV" } })).json;

    const updated = await t.call(`/drafts/${id}`, { method: "PUT", body: { ...input, sections: { opening: "Olá!", motivation: "Porque…" } } });
    expect(updated.json.sections).toEqual({ opening: "Olá!", motivation: "Porque…" });
    expect((await t.call("/drafts")).json.items.map((d: { id: string }) => d.id)).toEqual([id, second.id]);
    expect((await t.call(`/drafts/${id}`)).json.id).toBe(id);
    expect((await t.call(`/drafts/${id}`, { method: "DELETE" })).status).toBe(204);
    expect((await t.call(`/drafts/${id}`)).status).toBe(404);
    expect((await t.call(`/drafts/${id}`, { method: "PUT", body: input })).status).toBe(404);
  });

  it("valida tipo, título e seções", async () => {
    const res = await t.call("/drafts", { method: "POST", body: { type: "poem", title: " ", sections: { "Bad Key": "x" } } });
    expect(res.status).toBe(422);
    expect(res.json.error.fields).toEqual({ type: "invalid_option", title: "required", sections: "invalid_type" });
  });
});

describe("HTTP", () => {
  it("saúde verifica a base de dados", async () => {
    expect(await t.call("/health")).toMatchObject({ status: 200, json: { ok: true } });
  });

  it("rota desconhecida (404) e método não permitido (405 com Allow)", async () => {
    expect((await t.call("/nada")).json.error.code).toBe("route_not_found");
    const res = await t.call("/profile", { method: "DELETE" });
    expect(res.status).toBe(405);
    expect(res.headers.allow).toContain("PUT");
  });

  it("cabeçalhos: sem cache e com proteções básicas", async () => {
    const res = await t.call("/profile");
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("CORS libera só a origem do site, com credenciais", async () => {
    const res = await t.call("/scholarships", { headers: { origin: "http://localhost:3000" } });
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
    expect((await t.call("/scholarships", { headers: { origin: "https://malicioso.example" } })).headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("rota de reset não existe sem ALLOW_TEST_RESET", async () => {
    expect((await t.call("/__reset", { method: "POST" })).status).toBe(404);
  });
});
