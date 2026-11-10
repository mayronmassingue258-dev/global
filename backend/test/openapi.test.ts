import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openapiDocument } from "../src/openapi.js";
import { setupTestApp } from "./helpers.js";

let t: Awaited<ReturnType<typeof setupTestApp>>;
beforeAll(async () => { t = await setupTestApp(); });
afterAll(async () => { await t.close(); });

/** "/api/drafts/:id" → "/drafts/{id}" (formato OpenAPI, sem o prefixo do servidor). */
const toOpenApiPath = (url: string) => url.replace(/^\/api/, "").replace(/:([^/]+)/g, "{$1}");

describe("documentação OpenAPI", () => {
  it("toda rota da API está documentada, e nada documentado deixou de existir", () => {
    const fromServer = t.app.routeTable
      .filter((r) => r.url.startsWith("/api/") && !r.url.startsWith("/api/docs") && !r.url.startsWith("/api/__"))
      .map((r) => `${r.method} ${toOpenApiPath(r.url)}`)
      .sort();
    const documented = Object.entries(openapiDocument.paths)
      .flatMap(([path, ops]) => Object.keys(ops).map((m) => `${m.toUpperCase()} ${path}`))
      .sort();
    expect(documented).toEqual([...new Set(fromServer)]);
  });

  it("serve a especificação e a interface", async () => {
    const spec = await t.app.inject({ method: "GET", url: "/api/docs/json" });
    expect(spec.statusCode).toBe(200);
    expect(JSON.parse(spec.body)).toMatchObject({ openapi: "3.1.0", info: { title: "GlobalScholar API" } });
    const ui = await t.app.inject({ method: "GET", url: "/api/docs/" });
    expect(ui.statusCode).toBe(200);
    expect(ui.body).toContain("swagger");
  });

  it("todas as referências de esquema existem", () => {
    const refs = [...JSON.stringify(openapiDocument).matchAll(/#\/components\/schemas\/(\w+)/g)].map((m) => m[1]!);
    for (const name of new Set(refs)) expect(openapiDocument.components.schemas, name).toHaveProperty(name);
  });
});
