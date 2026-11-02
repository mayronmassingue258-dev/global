import { describe, expect, it } from "vitest";
import { formatDate } from "./date";

describe("formatDate", () => {
  it("formata AAAA-MM-DD em pt-BR sem deslocar o dia por fuso horário", () => {
    expect(formatDate("2027-02-15")).toMatch(/^15 de fev\.? de 2027$/);
    expect(formatDate("2027-01-01")).toMatch(/^1 de jan\.? de 2027$/);
  });

  it("aceita outro idioma", () => {
    expect(formatDate("2027-02-15", "en-US")).toBe("Feb 15, 2027");
  });

  it("mostra texto seguro para data inválida", () => {
    expect(formatDate("não é data")).toBe("Data não informada");
    expect(formatDate("")).toBe("Data não informada");
  });
});
