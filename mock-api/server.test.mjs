// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMockApi } from "./server.mjs";

let server;
let base;
let dir;
let dataFile;

const call = async (path, { method = "GET", body } = {}) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body)
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, json: text ? JSON.parse(text) : undefined };
};

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "mock-api-"));
  dataFile = join(dir, "db.json");
  server = await createMockApi({ dataFile });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(dir, { recursive: true, force: true });
});

beforeEach(async () => {
  await call("/__reset", { method: "POST" });
});

describe("bolsas", () => {
  it("lista com paginação e total", async () => {
    const { status, json } = await call("/scholarships?pageSize=2");
    expect(status).toBe(200);
    expect(json.items).toHaveLength(2);
    expect(json.total).toBe(6);
  });

  it("filtra e ordena", async () => {
    const { json } = await call("/scholarships?level=Mestrado&sort=title");
    expect(json.items.every((s) => s.level === "Mestrado")).toBe(true);
    const titles = json.items.map((s) => s.title);
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b, "pt-BR")));
  });

  it("valida a query com 400 invalid_query", async () => {
    const { status, json } = await call("/scholarships?sort=price&pageSize=0");
    expect(status).toBe(400);
    expect(json.error).toMatchObject({ code: "invalid_query", fields: { sort: "invalid_option", pageSize: "out_of_range" } });
  });

  it("detalhe e 404 no envelope de erro", async () => {
    expect((await call("/scholarships/amostra-001")).json.id).toBe("amostra-001");
    const missing = await call("/scholarships/nao-existe");
    expect(missing.status).toBe(404);
    expect(missing.json).toEqual({ error: { code: "not_found", message: "not_found" } });
  });
});

describe("perfil e elegibilidade", () => {
  it("perfil começa vazio e valida com 422", async () => {
    expect((await call("/profile")).json).toMatchObject({ residence: "", level: "" });
    const bad = await call("/profile", { method: "PUT", body: { residence: " ", level: "Mestrado", grade: 3 } });
    expect(bad.status).toBe(422);
    expect(bad.json.error.fields).toEqual({ residence: "required", grade: "invalid_type" });
  });

  it("elegibilidade muda conforme o perfil salvo", async () => {
    expect((await call("/scholarships/amostra-004/eligibility")).json.status).toBe("possible");

    await call("/profile", { method: "PUT", body: { residence: "Moçambique", level: "Mestrado" } });
    expect((await call("/scholarships/amostra-004/eligibility")).json.status).toBe("not_eligible");

    await call("/profile", { method: "PUT", body: { residence: "suica", level: "Mestrado" } });
    expect((await call("/scholarships/amostra-004/eligibility")).json.status).toBe("eligible");
  });

  it("JSON inválido devolve 400", async () => {
    const res = await call("/profile", { method: "PUT", body: "{nope" });
    expect(res.status).toBe(400);
    expect(res.json.error.code).toBe("invalid_json");
  });
});

describe("candidaturas", () => {
  it("cria (201), é idempotente (200), atualiza e remove", async () => {
    const created = await call("/applications", { method: "POST", body: { scholarshipId: "amostra-002" } });
    expect(created.status).toBe(201);
    expect(created.json).toMatchObject({ id: "amostra-002", status: "Saved", scholarship: { id: "amostra-002" } });

    expect((await call("/applications", { method: "POST", body: { scholarshipId: "amostra-002" } })).status).toBe(200);

    const patched = await call("/applications/amostra-002", { method: "PATCH", body: { status: "Ready to submit" } });
    expect(patched.json.status).toBe("Ready to submit");

    expect((await call("/applications")).json.items).toHaveLength(1);
    expect((await call("/applications/amostra-002", { method: "DELETE" })).status).toBe(204);
    expect((await call("/applications/amostra-002", { method: "DELETE" })).status).toBe(404);
  });

  it("valida bolsa e status", async () => {
    expect((await call("/applications", { method: "POST", body: { scholarshipId: "x" } })).json.error.fields).toEqual({ scholarshipId: "not_found" });
    await call("/applications", { method: "POST", body: { scholarshipId: "amostra-001" } });
    const bad = await call("/applications/amostra-001", { method: "PATCH", body: { status: "Won" } });
    expect(bad.status).toBe(422);
  });

  it("grava em arquivo (persistência)", async () => {
    await call("/applications", { method: "POST", body: { scholarshipId: "amostra-003" } });
    const db = JSON.parse(await readFile(dataFile, "utf8"));
    expect(db.applications.map((a) => a.id)).toEqual(["amostra-003"]);
  });

  it("grava em série sem perder alterações simultâneas", async () => {
    const ids = ["amostra-001", "amostra-002", "amostra-003", "amostra-004", "amostra-005"];
    await Promise.all(ids.map((scholarshipId) => call("/applications", { method: "POST", body: { scholarshipId } })));
    expect((await call("/applications")).json.items).toHaveLength(5);
  });
});

describe("HTTP", () => {
  it("responde preflight CORS", async () => {
    const res = await fetch(`${base}/profile`, { method: "OPTIONS" });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-methods")).toContain("PATCH");
  });

  it("rota desconhecida e método não permitido", async () => {
    expect((await call("/nada")).status).toBe(404);
    const res = await call("/profile", { method: "DELETE" });
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toContain("PUT");
  });
});

describe("reset desligado (servidor público)", () => {
  it("POST /__reset some quando allowReset=false", async () => {
    const other = await createMockApi({ dataFile: join(dir, "outro.json"), allowReset: false });
    await new Promise((resolve) => other.listen(0, "127.0.0.1", resolve));
    const res = await fetch(`http://127.0.0.1:${other.address().port}/api/__reset`, { method: "POST" });
    expect(res.status).toBe(404);
    await new Promise((resolve) => other.close(resolve));
  });
});
