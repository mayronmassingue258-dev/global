import { describe, expect, it } from "vitest";
import { PROFILE_MAX_LENGTH, emptyProfile, validateProfile } from "./profile";

describe("validateProfile", () => {
  it("exige país de residência e nível", () => {
    expect(validateProfile(emptyProfile)).toEqual({ residence: "required", level: "required" });
  });

  it("ignora espaços em branco ao checar obrigatórios", () => {
    expect(validateProfile({ ...emptyProfile, residence: "   ", level: "Mestrado" })).toEqual({ residence: "required" });
  });

  it("aceita um perfil mínimo válido", () => {
    expect(validateProfile({ ...emptyProfile, residence: "Moçambique", level: "Mestrado" })).toEqual({});
  });

  it("limita o tamanho dos campos", () => {
    const long = "x".repeat(PROFILE_MAX_LENGTH.languages + 1);
    expect(validateProfile({ ...emptyProfile, residence: "MZ", level: "Mestrado", languages: long })).toEqual({ languages: "too_long" });
  });
});
