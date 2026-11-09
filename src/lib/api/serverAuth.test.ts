import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieJar = new Map<string, string>();
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => (cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined) }) }));
const me = vi.fn();
vi.mock("@/lib/services", () => ({ authService: { me: (h?: Record<string, string>) => me(h) } }));

const { getCurrentUser, sessionHeaders } = await import("./serverAuth");

beforeEach(() => {
  cookieJar.clear();
  me.mockReset();
});

describe("serverAuth", () => {
  it("sem cookie: nenhum cabeçalho e nenhum pedido ao backend", async () => {
    expect(await sessionHeaders()).toBeUndefined();
    expect(await getCurrentUser()).toBeNull();
    expect(me).not.toHaveBeenCalled();
  });

  it("com cookie: repassa só o cookie de sessão", async () => {
    cookieJar.set("gs_session", "abc");
    expect(await sessionHeaders()).toEqual({ cookie: "gs_session=abc" });
  });

  it("backend fora do ar: segue como visitante", async () => {
    cookieJar.set("gs_session", "abc");
    me.mockRejectedValueOnce(new Error("offline"));
    expect(await getCurrentUser()).toBeNull();
  });
});
