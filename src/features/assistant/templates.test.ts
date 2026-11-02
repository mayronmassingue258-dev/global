import { describe, expect, it } from "vitest";
import { TEMPLATES, countWords, toPlainText } from "./templates";

describe("templates", () => {
  it("cada tipo tem seções com chaves únicas e válidas para a API", () => {
    for (const t of Object.values(TEMPLATES)) {
      const keys = t.sections.map((s) => s.key);
      expect(new Set(keys).size).toBe(keys.length);
      expect(keys.every((k) => /^[a-z][a-z0-9_]{0,39}$/.test(k))).toBe(true);
    }
  });

  it("countWords ignora espaços extras", () => {
    expect(countWords("  um   dois\ntrês ")).toBe(3);
    expect(countWords("   ")).toBe(0);
  });

  it("toPlainText junta só as seções preenchidas, na ordem do modelo", () => {
    const text = toPlainText("Minha carta", "motivation_letter", { goals: "Voltar e ensinar.", opening: "Candidato-me ao Mestrado X.", fit: "  " });
    expect(text).toBe("Minha carta\n\n\nABERTURA\n\nCandidato-me ao Mestrado X.\n\n\nOBJETIVOS\n\nVoltar e ensinar.");
  });
});
