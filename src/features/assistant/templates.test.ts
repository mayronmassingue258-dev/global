import { describe, expect, it } from "vitest";
import pt from "@/i18n/dictionaries/pt";
import en from "@/i18n/dictionaries/en";
import { DOCUMENT_TYPE_ORDER, countWords, getTemplate, sectionKeys, toPlainText } from "./templates";

describe("templates", () => {
  it("cada tipo tem seções com chaves únicas e válidas para a API, com texto nos dois idiomas", () => {
    for (const type of DOCUMENT_TYPE_ORDER) {
      const keys = sectionKeys(type);
      expect(new Set(keys).size).toBe(keys.length);
      expect(keys.every((k) => /^[a-z][a-z0-9_]{0,39}$/.test(k))).toBe(true);
      for (const dict of [pt, en]) {
        const tpl = getTemplate(dict, type);
        expect(tpl.sections.every((s) => s.title && s.hint)).toBe(true);
      }
    }
  });

  it("countWords ignora espaços extras", () => {
    expect(countWords("  um   dois\ntrês ")).toBe(3);
    expect(countWords("   ")).toBe(0);
  });

  it("toPlainText junta só as seções preenchidas, na ordem do modelo e no idioma escolhido", () => {
    const sections = { goals: "Voltar e ensinar.", opening: "Candidato-me ao Mestrado X.", fit: "  " };
    expect(toPlainText(getTemplate(pt, "motivation_letter"), "Minha carta", sections)).toBe(
      "Minha carta\n\n\nABERTURA\n\nCandidato-me ao Mestrado X.\n\n\nOBJETIVOS\n\nVoltar e ensinar."
    );
    expect(toPlainText(getTemplate(en, "motivation_letter"), "Letter", sections)).toContain("OPENING");
  });
});
