import { describe, expect, it } from "vitest";
import { completenessOf, emptyProfile, toInput, validateProfile } from "./profile";

describe("validateProfile", () => {
  it("perfil vazio é válido (o formulário salva por etapas)", () => {
    expect(validateProfile(emptyProfile)).toEqual({});
  });

  it("nota acima da escala, anos fora do intervalo e testes inválidos", () => {
    const year = new Date().getFullYear();
    expect(validateProfile({
      ...emptyProfile, gpa: { value: 21, scale: "20" }, birthYear: year, startYear: year - 1, workYears: -1,
      tests: [{ type: "ielts", score: 10 }]
    })).toEqual({ gpa: "out_of_range", birthYear: "out_of_range", startYear: "out_of_range", workYears: "out_of_range", tests: "out_of_range" });
  });

  it("limites e repetições", () => {
    expect(validateProfile({
      ...emptyProfile, nationalities: ["MZ", "AO", "BR", "PT"], fields: ["law", "education", "agriculture", "engineering"],
      languages: [{ code: "en", level: "B2" }, { code: "en", level: "C1" }], goals: "x".repeat(1001)
    })).toEqual({ nationalities: "too_long", fields: "too_long", languages: "duplicate", goals: "too_long" });
  });
});

describe("completude e conversão", () => {
  it("conta os 12 itens principais", () => {
    expect(completenessOf(emptyProfile)).toMatchObject({ percent: 0 });
    expect(completenessOf({ ...emptyProfile, nationalities: ["MZ"], residenceCountry: "MZ", fundingNeed: "full" }).percent).toBe(25);
  });

  it("toInput descarta metadados do servidor", () => {
    const input = toInput({ ...emptyProfile, goals: "x", completeness: { percent: 0, missing: [] }, updatedAt: "2026-01-01T00:00:00Z" });
    expect(input).toEqual({ ...emptyProfile, goals: "x" });
  });
});
