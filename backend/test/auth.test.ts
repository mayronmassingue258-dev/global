import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { sessions, users } from "../src/db/schema.js";
import { hashPassword, verifyPassword } from "../src/auth/passwords.js";
import { hashToken } from "../src/auth/tokens.js";
import { setupTestApp } from "./helpers.js";

let t: Awaited<ReturnType<typeof setupTestApp>>;
beforeAll(async () => { t = await setupTestApp(); });
afterAll(async () => { await t.close(); });
beforeEach(async () => { await t.reset(); });

const register = (body: Record<string, unknown>) => t.call("/auth/register", { method: "POST", body, cookie: null });
const login = (email: string, password: string) => t.call("/auth/login", { method: "POST", body: { email, password }, cookie: null });

describe("senhas", () => {
  it("guarda só o hash (scrypt) e verifica corretamente", async () => {
    const stored = await hashPassword("minha senha");
    expect(stored).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(stored).not.toContain("minha senha");
    expect(await verifyPassword("minha senha", stored)).toBe(true);
    expect(await verifyPassword("outra", stored)).toBe(false);
    expect(await verifyPassword("x", "formato-invalido")).toBe(false);
  });

  it("dois hashes da mesma senha são diferentes (sal aleatório)", async () => {
    expect(await hashPassword("igual")).not.toBe(await hashPassword("igual"));
  });
});

describe("cadastro", () => {
  it("cria a conta, inicia a sessão e devolve só dados públicos", async () => {
    const res = await register({ name: " Ana Silva ", email: " Ana@Exemplo.com ", password: "senha-segura-1" });
    expect(res.status).toBe(201);
    expect(res.json.user).toMatchObject({ name: "Ana Silva", email: "ana@exemplo.com" });
    expect(Object.keys(res.json.user).sort()).toEqual(["email", "id", "name"]);
    expect(res.rawSetCookie).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/" });
    const me = await t.call("/auth/me", { cookie: res.sessionCookie });
    expect(me.json.user.email).toBe("ana@exemplo.com");
  });

  it("a base guarda só o hash da senha e do token da sessão", async () => {
    const res = await register({ name: "Ana", email: "ana@exemplo.com", password: "senha-segura-1" });
    const [user] = await t.db.select().from(users);
    expect(user!.passwordHash).not.toContain("senha-segura-1");
    const token = res.sessionCookie!.split("=")[1]!;
    const rows = await t.db.select().from(sessions);
    expect(rows.map((s) => s.id)).toEqual([hashToken(token)]);
  });

  it("valida campos com os códigos do contrato", async () => {
    const res = await register({ name: "", email: "sem-arroba", password: "123" });
    expect(res.status).toBe(422);
    expect(res.json.error.fields).toEqual({ name: "required", email: "invalid", password: "too_short" });
    expect((await register({ name: "A", email: "a@b.co", password: "x".repeat(201) })).json.error.fields).toEqual({ password: "too_long" });
  });

  it("e-mail já cadastrado (sem diferenciar maiúsculas) → 409 email_taken", async () => {
    await register({ name: "Ana", email: "ana@exemplo.com", password: "senha-segura-1" });
    const dup = await register({ name: "Outra", email: "ANA@exemplo.com", password: "senha-segura-2" });
    expect(dup.status).toBe(409);
    expect(dup.json.error).toMatchObject({ code: "email_taken", fields: { email: "taken" } });
  });

  it("cadastros simultâneos com o mesmo e-mail criam uma conta só", async () => {
    const results = await Promise.all([1, 2, 3].map(() => register({ name: "Ana", email: "ana@exemplo.com", password: "senha-segura-1" })));
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
  });
});

describe("login e sessão", () => {
  beforeEach(async () => {
    await register({ name: "Ana", email: "ana@exemplo.com", password: "senha-segura-1" });
  });

  it("entra com e-mail em qualquer caixa", async () => {
    const res = await login("ANA@exemplo.com", "senha-segura-1");
    expect(res.status).toBe(200);
    expect(res.sessionCookie).toBeTruthy();
  });

  it("senha errada e e-mail inexistente dão a MESMA resposta (não revela quem tem conta)", async () => {
    const wrong = await login("ana@exemplo.com", "errada-errada");
    const unknown = await login("ninguem@exemplo.com", "errada-errada");
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.json).toEqual(unknown.json);
    expect(wrong.json.error.code).toBe("invalid_credentials");
  });

  it("sem cookie, rotas do estudante dão 401 e as públicas funcionam", async () => {
    for (const path of ["/profile", "/applications", "/drafts", "/scholarships/amostra-001/eligibility", "/auth/me"]) {
      const res = await t.call(path, { cookie: null });
      expect(res.status, path).toBe(401);
      expect(res.json.error.code).toBe("unauthenticated");
    }
    expect((await t.call("/scholarships", { cookie: null })).status).toBe(200);
    expect((await t.call("/scholarships/amostra-001", { cookie: null })).status).toBe(200);
  });

  it("cookie falso ou de sessão encerrada não autentica", async () => {
    expect((await t.call("/profile", { cookie: "gs_session=falso" })).status).toBe(401);
    const { sessionCookie } = await login("ana@exemplo.com", "senha-segura-1");
    expect((await t.call("/auth/logout", { method: "POST", cookie: sessionCookie })).status).toBe(204);
    expect((await t.call("/profile", { cookie: sessionCookie })).status).toBe(401);
  });

  it("sessão vencida é recusada e apagada", async () => {
    const { sessionCookie } = await login("ana@exemplo.com", "senha-segura-1");
    const id = hashToken(sessionCookie!.split("=")[1]!);
    await t.db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.id, id));
    expect((await t.call("/profile", { cookie: sessionCookie })).status).toBe(401);
    expect(await t.db.select().from(sessions).where(eq(sessions.id, id))).toHaveLength(0);
  });

  it("sessão em uso é renovada", async () => {
    const { sessionCookie } = await login("ana@exemplo.com", "senha-segura-1");
    const id = hashToken(sessionCookie!.split("=")[1]!);
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    await t.db.update(sessions).set({ expiresAt: soon }).where(eq(sessions.id, id));
    await t.call("/profile", { cookie: sessionCookie });
    const [row] = await t.db.select().from(sessions).where(eq(sessions.id, id));
    expect(row!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000);
  });
});

describe("isolamento entre estudantes", () => {
  it("cada estudante vê e altera só os próprios dados", async () => {
    const ana = await t.signUp("ana@exemplo.com");
    const bia = await t.signUp("bia@exemplo.com");

    await t.call("/profile", { method: "PUT", body: { residence: "Angola", level: "Mestrado" }, cookie: ana });
    await t.call("/applications", { method: "POST", body: { scholarshipId: "amostra-001" }, cookie: ana });
    const draft = (await t.call("/drafts", { method: "POST", body: { type: "academic_cv", title: "CV da Ana", sections: {} }, cookie: ana })).json;

    expect((await t.call("/profile", { cookie: bia })).json.residence).toBe("");
    expect((await t.call("/applications", { cookie: bia })).json.items).toEqual([]);
    expect((await t.call("/drafts", { cookie: bia })).json.items).toEqual([]);
    // Mesmo sabendo os ids, a Bia não lê, altera nem apaga nada da Ana (404, como se não existisse).
    expect((await t.call("/applications/amostra-001", { cookie: bia })).status).toBe(404);
    expect((await t.call("/applications/amostra-001", { method: "PATCH", body: { status: "Submitted" }, cookie: bia })).status).toBe(404);
    expect((await t.call("/applications/amostra-001", { method: "DELETE", cookie: bia })).status).toBe(404);
    expect((await t.call(`/drafts/${draft.id}`, { cookie: bia })).status).toBe(404);
    expect((await t.call(`/drafts/${draft.id}`, { method: "PUT", body: { type: "academic_cv", title: "Roubado", sections: {} }, cookie: bia })).status).toBe(404);

    // A Bia salvar a mesma bolsa cria a candidatura DELA, independente.
    expect((await t.call("/applications", { method: "POST", body: { scholarshipId: "amostra-001" }, cookie: bia })).status).toBe(201);
    expect((await t.call("/applications/amostra-001", { cookie: ana })).json.status).toBe("Saved");

    // Elegibilidade usa o perfil de quem pergunta.
    expect((await t.call("/scholarships/amostra-004/eligibility", { cookie: ana })).json.status).toBe("not_eligible");
    expect((await t.call("/scholarships/amostra-004/eligibility", { cookie: bia })).json.status).toBe("possible");
  });
});

describe("redefinição de senha", () => {
  beforeEach(async () => {
    await register({ name: "Ana", email: "ana@exemplo.com", password: "senha-antiga-1" });
  });

  const linkToken = () => {
    const match = t.emails.at(-1)?.text.match(/reset-password\?token=([\w%-]+)/);
    return match ? decodeURIComponent(match[1]!) : null;
  };

  it("envia link com token, troca a senha, invalida o link e encerra as sessões abertas", async () => {
    const { sessionCookie: oldSession } = await login("ana@exemplo.com", "senha-antiga-1");
    expect((await t.call("/auth/forgot-password", { method: "POST", body: { email: "Ana@Exemplo.com" }, cookie: null })).status).toBe(204);
    expect(t.emails).toHaveLength(1);
    expect(t.emails[0]).toMatchObject({ to: "ana@exemplo.com", subject: expect.stringContaining("senha") });
    expect(t.emails[0]!.text).toContain("http://localhost:3000/reset-password?token=");
    const token = linkToken()!;

    const reset = await t.call("/auth/reset-password", { method: "POST", body: { token, password: "senha-nova-123" }, cookie: null });
    expect(reset.status).toBe(204);
    expect((await login("ana@exemplo.com", "senha-antiga-1")).status).toBe(401);
    expect((await login("ana@exemplo.com", "senha-nova-123")).status).toBe(200);
    expect((await t.call("/profile", { cookie: oldSession })).status).toBe(401);

    const again = await t.call("/auth/reset-password", { method: "POST", body: { token, password: "outra-senha-9" }, cookie: null });
    expect(again.status).toBe(400);
    expect(again.json.error.code).toBe("invalid_token");
  });

  it("e-mail desconhecido: mesma resposta 204 e nenhum e-mail enviado", async () => {
    expect((await t.call("/auth/forgot-password", { method: "POST", body: { email: "ninguem@exemplo.com" }, cookie: null })).status).toBe(204);
    expect(t.emails).toHaveLength(0);
  });

  it("token inválido, vencido ou senha fraca são recusados", async () => {
    expect((await t.call("/auth/reset-password", { method: "POST", body: { token: "inventado", password: "senha-nova-123" }, cookie: null })).json.error.code).toBe("invalid_token");
    await t.call("/auth/forgot-password", { method: "POST", body: { email: "ana@exemplo.com" }, cookie: null });
    const weak = await t.call("/auth/reset-password", { method: "POST", body: { token: linkToken(), password: "123" }, cookie: null });
    expect(weak.json.error.fields).toEqual({ password: "too_short" });
  });
});

describe("proteções", () => {
  it("alterações vindas de outro site são bloqueadas (CSRF)", async () => {
    const cookie = await t.signUp();
    const res = await t.call("/profile", { method: "PUT", body: { residence: "X", level: "Mestrado" }, cookie, headers: { origin: "https://malicioso.example" } });
    expect(res.status).toBe(403);
    expect(res.json.error.code).toBe("forbidden_origin");
    const ok = await t.call("/profile", { method: "PUT", body: { residence: "X", level: "Mestrado" }, cookie, headers: { origin: "http://localhost:3000" } });
    expect(ok.status).toBe(200);
  });

  it("limita tentativas de login por minuto (429)", async () => {
    const limited = await setupTestApp({ authRateLimit: 3 });
    try {
      const statuses: number[] = [];
      for (let i = 0; i < 5; i += 1) statuses.push((await limited.call("/auth/login", { method: "POST", body: { email: "a@b.co", password: "x" }, cookie: null })).status);
      expect(statuses).toEqual([401, 401, 401, 429, 429]);
    } finally {
      await limited.close();
    }
  });

  it("cookie Secure em produção", async () => {
    const prod = await setupTestApp({ env: { NODE_ENV: "production" } });
    try {
      await prod.reset();
      const res = await prod.call("/auth/register", { method: "POST", body: { name: "A", email: "a@b.co", password: "senha-segura-1" }, cookie: null });
      expect(res.rawSetCookie).toMatchObject({ secure: true, httpOnly: true });
    } finally {
      await prod.close();
    }
  });
});
