import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLoginThrottle } from "../src/app.js";
import { setupTestApp } from "./helpers.js";

describe("bloqueio de login por conta", () => {
  it("10 senhas erradas para o mesmo e-mail bloqueiam; outro e-mail segue livre", () => {
    const throttle = createLoginThrottle(3, 60_000);
    for (let i = 0; i < 3; i += 1) throttle.fail("ana@exemplo.com");
    expect(throttle.blocked("ana@exemplo.com")).toBe(true);
    expect(throttle.blocked("bia@exemplo.com")).toBe(false);
    throttle.reset("ana@exemplo.com");
    expect(throttle.blocked("ana@exemplo.com")).toBe(false);
  });

  it("a janela expira", () => {
    const throttle = createLoginThrottle(1, -1);
    throttle.fail("ana@exemplo.com");
    expect(throttle.blocked("ana@exemplo.com")).toBe(false);
  });
});

describe("limites na API", () => {
  let t: Awaited<ReturnType<typeof setupTestApp>>;
  beforeAll(async () => {
    t = await setupTestApp({ env: { INTERNAL_API_SECRET: "segredo-interno-de-teste-123" } });
    await t.reset();
  });
  afterAll(async () => { await t.close(); });

  it("depois de 10 senhas erradas, nem a senha certa entra (até a janela passar)", async () => {
    await t.signUp("ana@exemplo.com", "senha-certa-123");
    for (let i = 0; i < 10; i += 1) {
      expect((await t.call("/auth/login", { method: "POST", body: { email: "ana@exemplo.com", password: "errada" }, cookie: null })).status).toBe(401);
    }
    const blocked = await t.call("/auth/login", { method: "POST", body: { email: "ana@exemplo.com", password: "senha-certa-123" }, cookie: null });
    expect(blocked.status).toBe(429);
    expect(blocked.json.error.code).toBe("rate_limited");
  });

  it("o servidor do site, com a chave interna, não entra no limite global", async () => {
    const statuses = new Set<number>();
    for (let i = 0; i < 620; i += 1) {
      statuses.add((await t.call("/scholarships/amostra-001", { cookie: null, headers: { "x-gs-internal": "segredo-interno-de-teste-123" } })).status);
    }
    expect([...statuses]).toEqual([200]);
  });

  it("chave interna errada não ajuda: visitante comum é limitado a 600/min por IP", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 605; i += 1) statuses.push((await t.call("/scholarships/amostra-002", { cookie: null, headers: { "x-gs-internal": "chute-errado-chute-errado" } })).status);
    expect(statuses.slice(0, 590).every((s) => s === 200)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });
});
