import { describe, expect, it } from "vitest";
import { isProtectedPath, loginUrl, safeNextPath } from "./routes";

describe("rotas de autenticação", () => {
  it("identifica áreas protegidas, inclusive sub-rotas", () => {
    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/applications/amostra-001")).toBe(true);
    expect(isProtectedPath("/scholarships")).toBe(false);
    expect(isProtectedPath("/profiles-publicos")).toBe(false);
  });

  it("só aceita destinos internos depois do login (sem redirecionamento aberto)", () => {
    expect(safeNextPath("/applications?x=1")).toBe("/applications?x=1");
    expect(safeNextPath("//malicioso.example")).toBe("/dashboard");
    expect(safeNextPath("https://malicioso.example")).toBe("/dashboard");
    expect(safeNextPath("/\\malicioso.example")).toBe("/dashboard");
    expect(safeNextPath(null)).toBe("/dashboard");
  });

  it("monta o link de login com o destino codificado", () => {
    expect(loginUrl("/profile?a=b")).toBe("/login?next=%2Fprofile%3Fa%3Db");
  });
});
