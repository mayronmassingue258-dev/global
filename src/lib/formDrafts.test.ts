import { afterEach, describe, expect, it, vi } from "vitest";
import { clearFormDraft, readFormDraft, writeFormDraft } from "./formDrafts";

const isStringRecord = (v: unknown): v is Record<string, string> => typeof v === "object" && v !== null;

afterEach(() => window.sessionStorage.clear());

describe("formDrafts", () => {
  it("grava, lê e apaga na sessão da aba", () => {
    writeFormDraft("perfil", { residence: "MZ" });
    expect(readFormDraft("perfil", isStringRecord)).toEqual({ residence: "MZ" });
    clearFormDraft("perfil");
    expect(readFormDraft("perfil", isStringRecord)).toBeNull();
  });

  it("ignora conteúdo inválido ou corrompido", () => {
    window.sessionStorage.setItem("gs:unsaved:x", "{quebrado");
    expect(readFormDraft("x", isStringRecord)).toBeNull();
    window.sessionStorage.setItem("gs:unsaved:y", "42");
    expect(readFormDraft("y", isStringRecord)).toBeNull();
  });

  it("não quebra quando o armazenamento está bloqueado", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("bloqueado"); });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("bloqueado"); });
    expect(() => writeFormDraft("a", {})).not.toThrow();
    expect(readFormDraft("a", isStringRecord)).toBeNull();
  });
});
