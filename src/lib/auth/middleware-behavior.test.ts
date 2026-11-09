// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

afterEach(() => vi.unstubAllEnvs());

describe("middleware (comportamento)", () => {
  it("sem cookie de sessão, área privada vai para o login com o destino", () => {
    const res = middleware(new NextRequest("http://localhost:3000/applications/amostra-001?tab=notas"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login?next=%2Fapplications%2Famostra-001%3Ftab%3Dnotas");
  });

  it("com cookie, segue (quem valida a sessão é o backend)", () => {
    const req = new NextRequest("http://localhost:3000/profile", { headers: { cookie: "gs_session=abc" } });
    expect(middleware(req).headers.get("x-middleware-next")).toBe("1");
  });

  it("no modo demonstração não há login", () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_MODE", "mock");
    expect(middleware(new NextRequest("http://localhost:3000/profile")).headers.get("x-middleware-next")).toBe("1");
  });
});
