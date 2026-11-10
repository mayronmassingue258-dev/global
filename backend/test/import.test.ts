import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { importScholarships, validateScholarships, type ScholarshipInput } from "../src/db/import-scholarships.js";
import { setupTestApp } from "./helpers.js";

const example = JSON.parse(readFileSync(new URL("../scholarships.example.json", import.meta.url), "utf8"));

describe("validação do arquivo de bolsas", () => {
  it("o arquivo de exemplo é válido", () => {
    expect(validateScholarships(example)).toMatchObject({ ok: true });
  });

  it("aponta todos os problemas com posição e campo", () => {
    const bad = [
      { ...example[0], id: "Com Espaço", deadline: "2027-13-40", level: "Pós", sourceUrl: "http://inseguro.org" },
      { ...example[0], extra: 1 },
      example[0],
      example[0]
    ];
    const result = validateScholarships(bad);
    expect(result.ok).toBe(false);
    const errors = (result as { errors: string[] }).errors.join("\n");
    expect(errors).toContain("#1 (Com Espaço) id:");
    expect(errors).toContain("#1 (Com Espaço) deadline:");
    expect(errors).toContain("#1 (Com Espaço) level:");
    expect(errors).toContain("#1 (Com Espaço) sourceUrl: use https://");
    expect(errors).toMatch(/#2 .*extra|#2 .*\(item\)/);
    expect(errors).toContain("#4 (exemplo-mestrado-saude-publica-2027) id: repetido no arquivo");
  });

  it("recusa algo que não é lista", () => {
    expect(validateScholarships({})).toMatchObject({ ok: false });
  });
});

describe("importação", () => {
  let t: Awaited<ReturnType<typeof setupTestApp>>;
  beforeAll(async () => { t = await setupTestApp(); });
  afterAll(async () => { await t.close(); });
  beforeEach(async () => { await t.reset(); });

  it("grava, atualiza e pode remover as bolsas de demonstração; a bolsa nova funciona na API", async () => {
    const result = validateScholarships(example);
    if (!result.ok) throw new Error(result.errors.join("; "));
    const items: ScholarshipInput[] = result.items;
    expect(await importScholarships(t.db, items)).toEqual({ imported: 1, removed: 0 });
    expect((await t.call("/scholarships", { cookie: null })).json.total).toBe(7);

    const updated = [{ ...items[0]!, title: "Título corrigido" }];
    expect(await importScholarships(t.db, updated, { removeDemo: true })).toEqual({ imported: 1, removed: 6 });
    const list = (await t.call("/scholarships", { cookie: null })).json;
    expect(list.total).toBe(1);
    expect(list.items[0]).toMatchObject({ id: "exemplo-mestrado-saude-publica-2027", title: "Título corrigido", verification: { status: "verified", verifiedAt: "2026-11-10" } });

    const cookie = await t.signUp();
    await t.call("/profile", { method: "PUT", body: { residence: "Brasil", level: "Mestrado" }, cookie });
    const eligibility = (await t.call("/scholarships/exemplo-mestrado-saude-publica-2027/eligibility", { cookie })).json;
    expect(eligibility.status).toBe("not_eligible");
  });
});
