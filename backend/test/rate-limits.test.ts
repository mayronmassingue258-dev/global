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
    expect(blocked.json.error.code).toBe("account_locked");
  });

  it("definir uma senha nova pelo link do e-mail desbloqueia a conta na hora", async () => {
    // (continua do teste anterior: ana@exemplo.com está bloqueada)
    await t.call("/auth/forgot-password", { method: "POST", body: { email: "ana@exemplo.com" }, cookie: null });
    const token = new URL(t.emails.at(-1)!.text.match(/https?:\/\/\S+/)![0]).searchParams.get("token")!;
    expect((await t.call("/auth/reset-password", { method: "POST", body: { token, password: "senha-nova-456" }, cookie: null })).status).toBe(204);
    expect((await t.call("/auth/login", { method: "POST", body: { email: "ana@exemplo.com", password: "senha-nova-456" }, cookie: null })).status).toBe(200);
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

describe("limites por visitante quando o pedido passa pelo site", () => {
  const SECRET = "segredo-interno-de-teste-123";
  let t: Awaited<ReturnType<typeof setupTestApp>>;
  beforeAll(async () => {
    t = await setupTestApp({ authRateLimit: 3, env: { INTERNAL_API_SECRET: SECRET } });
    await t.reset();
  });
  afterAll(async () => { await t.close(); });

  const login = (headers: Record<string, string>) =>
    t.call("/auth/login", { method: "POST", body: { email: "ninguem@exemplo.com", password: "qualquer-coisa" }, cookie: null, headers });
  const viaSite = (ip: string) => ({ "x-gs-internal": SECRET, "x-gs-client-ip": ip });

  it("cada visitante tem o próprio limite de login, mesmo vindo todos do servidor do site", async () => {
    for (let i = 0; i < 3; i += 1) expect((await login(viaSite("203.0.113.10"))).status).toBe(401);
    expect((await login(viaSite("203.0.113.10"))).status).toBe(429);
    // Outro estudante, no mesmo instante, entra normalmente.
    expect((await login(viaSite("203.0.113.20"))).status).toBe(401);
  });

  it("x-gs-client-ip sem a chave interna é ignorado (não dá para forjar outro IP)", async () => {
    const forged = (ip: string) => ({ "x-gs-client-ip": ip, "cf-connecting-ip": "198.51.100.7" });
    for (let i = 0; i < 3; i += 1) expect((await login(forged(`192.0.2.${i + 1}`))).status).toBe(401);
    // Trocar o IP "informado" não ajuda: o limite é do IP real (aqui, o do Cloudflare).
    expect((await login(forged("192.0.2.99"))).status).toBe(429);
  });

  it("valor que não é IP é ignorado", async () => {
    for (let i = 0; i < 3; i += 1) expect((await login(viaSite("não-é-ip"))).status).toBe(401);
    expect((await login(viaSite("também-não"))).status).toBe(429);
  });
});
