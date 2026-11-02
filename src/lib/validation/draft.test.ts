import { describe, expect, it } from "vitest";
import { validateDraft } from "./draft";

const ok = { type: "motivation_letter" as const, title: "Carta", program: "", sections: { opening: "Olá" } };

describe("validateDraft", () => {
  it("aceita rascunho válido", () => expect(validateDraft(ok)).toEqual({}));
  it("exige título", () => expect(validateDraft({ ...ok, title: "  " })).toEqual({ title: "required" }));
  it("rejeita tipo e chave de seção inválidos", () => {
    expect(validateDraft({ ...ok, type: "poema" as never, sections: { "Abertura!": "x" } })).toEqual({ type: "invalid_option", sections: "invalid_type" });
  });
  it("limita tamanhos", () => {
    expect(validateDraft({ ...ok, program: "p".repeat(161), sections: { opening: "x".repeat(20001) } })).toEqual({ program: "too_long", sections: "too_long" });
  });
});
