import { describe, expect, it } from "vitest";
import { readSearchFilters, writeSearchFilters } from "./searchParams";

describe("filtros na URL", () => {
  it("lê valores válidos e ignora os desconhecidos", () => {
    expect(readSearchFilters(new URLSearchParams("q=%20dados%20&level=Mestrado&country=Canad%C3%A1&sort=title"))).toEqual({ q: "dados", level: "Mestrado", country: "Canadá", sort: "title" });
    expect(readSearchFilters(new URLSearchParams("level=Pos&sort=preco"))).toEqual({ q: "", level: "", country: "", sort: "deadline" });
    expect(readSearchFilters(null)).toEqual({ q: "", level: "", country: "", sort: "deadline" });
  });

  it("limita o tamanho do texto vindo da URL", () => {
    expect(readSearchFilters(new URLSearchParams(`q=${"a".repeat(500)}`)).q).toHaveLength(100);
  });

  it("escreve só o que não é padrão, em ordem estável", () => {
    expect(writeSearchFilters({ q: "", level: "", country: "", sort: "deadline" }).toString()).toBe("");
    expect(writeSearchFilters({ sort: "title", country: " Japão ", level: "Doutorado", q: "x" }).toString()).toBe("q=x&level=Doutorado&country=Jap%C3%A3o&sort=title");
  });
});
