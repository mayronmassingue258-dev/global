import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse } from "@/test/fakes";
import { mockAuthService } from "@/mocks/authService";
import { apiAuthService } from "./auth";

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);
afterEach(() => fetchMock.mockReset());

const user = { id: "u1", email: "ana@exemplo.com", name: "Ana" };
const last = () => {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return { url: String(url), method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined, init };
};

describe("apiAuthService", () => {
  it("cadastro, login, sair, esqueci e nova senha seguem o contrato", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ user }, 201));
    await expect(apiAuthService.register({ name: "Ana", email: "ana@exemplo.com", password: "x" })).resolves.toEqual(user);
    expect(last()).toMatchObject({ url: "http://api.test/api/auth/register", method: "POST", body: { name: "Ana", email: "ana@exemplo.com", password: "x" } });
    expect(last().init?.credentials).toBe("same-origin");

    fetchMock.mockResolvedValueOnce(jsonResponse({ user }));
    await apiAuthService.login("ana@exemplo.com", "x");
    expect(last()).toMatchObject({ url: "http://api.test/api/auth/login", body: { email: "ana@exemplo.com", password: "x" } });

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await apiAuthService.logout();
    expect(last()).toMatchObject({ url: "http://api.test/api/auth/logout", method: "POST" });

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await apiAuthService.forgotPassword("ana@exemplo.com");
    expect(last().body).toEqual({ email: "ana@exemplo.com" });

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await apiAuthService.resetPassword("tok", "nova-senha");
    expect(last()).toMatchObject({ url: "http://api.test/api/auth/reset-password", body: { token: "tok", password: "nova-senha" } });
  });

  it("me: devolve o estudante, null sem sessão, e repassa o cookie quando chamado no servidor", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ user }));
    await expect(apiAuthService.me({ cookie: "gs_session=abc" })).resolves.toEqual(user);
    expect(new Headers(last().init?.headers).get("cookie")).toBe("gs_session=abc");
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: "unauthenticated" } }, 401));
    await expect(apiAuthService.me()).resolves.toBeNull();
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));
    await expect(apiAuthService.me()).rejects.toMatchObject({ status: 500 });
  });

  it("resposta sem usuário válido é recusada", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ user: { id: 1 } }));
    await expect(apiAuthService.login("a@b.co", "x")).rejects.toMatchObject({ code: "unexpected_response" });
  });

  it("401 numa área privada leva ao login (e volta depois); em página pública, não", async () => {
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", { configurable: true, value: { ...original, pathname: "/profile", search: "?a=1", assign } });
    try {
      const { apiProfileService } = await import("./profile");
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: "unauthenticated" } }, 401));
      await expect(apiProfileService.get()).rejects.toMatchObject({ status: 401 });
      expect(assign).toHaveBeenCalledWith("/login?next=%2Fprofile%3Fa%3D1");

      Object.defineProperty(window, "location", { configurable: true, value: { ...original, pathname: "/scholarships", search: "", assign } });
      assign.mockClear();
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: "unauthenticated" } }, 401));
      await expect(apiProfileService.get()).rejects.toMatchObject({ status: 401 });
      expect(assign).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: original });
    }
  });
});

describe("mockAuthService (modo demonstração)", () => {
  it("está sempre logado e aceita qualquer ação", async () => {
    await expect(mockAuthService.me()).resolves.toMatchObject({ name: "Estudante" });
    await expect(mockAuthService.register({ name: "Ana", email: "a@b.co", password: "x" })).resolves.toMatchObject({ name: "Ana", email: "a@b.co" });
    await expect(mockAuthService.login("b@c.co", "x")).resolves.toMatchObject({ email: "b@c.co" });
    await expect(mockAuthService.logout()).resolves.toBeUndefined();
    await expect(mockAuthService.forgotPassword("a@b.co")).resolves.toBeUndefined();
    await expect(mockAuthService.resetPassword("t", "p")).resolves.toBeUndefined();
  });
});
