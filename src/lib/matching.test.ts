import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as vocab from "./matching";
import pt from "@/i18n/dictionaries/pt";
import en from "@/i18n/dictionaries/en";
import { reasonText } from "@/features/matching/reasons";

const backend = (file: string) => readFileSync(resolve(__dirname, "../../backend/src/matching", file), "utf8");

/** Lê `export const NOME = [ ... ] as const;` de um arquivo do backend. */
function backendList(source: string, name: string): string[] {
  const match = source.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const;`));
  if (!match) throw new Error(`${name} não encontrado no backend`);
  return [...match[1]!.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
}

describe("vocabulário igual ao do backend", () => {
  const model = backend("model.ts");
  const names = ["TARGET_LEVELS", "COMPLETED_LEVELS", "FIELDS", "LANGUAGES", "LANGUAGE_LEVELS", "TESTS", "GPA_SCALES", "COVERAGE", "FUNDING_NEEDS", "STUDY_MODES", "SCHOLARSHIP_MODES", "GROUPS", "EXPERIENCE"] as const;
  for (const name of names) {
    it(name, () => expect([...vocab[name]]).toEqual(backendList(model, name)));
  }
  it("países e grupos", () => {
    const countries = backend("countries.ts");
    expect([...vocab.COUNTRY_CODES]).toEqual(backendList(countries, "COUNTRY_CODES"));
    for (const [group, codes] of Object.entries(vocab.COUNTRY_GROUPS)) {
      const block = countries.match(new RegExp(`"${group}": \\[([\\s\\S]*?)\\]`))![1]!;
      expect([...codes], group).toEqual([...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]));
    }
  });
});

describe("rótulos", () => {
  it("todo código do vocabulário tem rótulo em PT e EN", () => {
    const tables = [
      [vocab.TARGET_LEVELS, "targetLevel"], [vocab.COMPLETED_LEVELS, "completedLevel"], [vocab.FIELDS, "field"], [vocab.LANGUAGES, "language"],
      [vocab.LANGUAGE_LEVELS, "languageLevel"], [vocab.TESTS, "test"], [vocab.GPA_SCALES, "gpaScale"], [vocab.COVERAGE, "coverage"],
      [vocab.FUNDING_NEEDS, "fundingNeed"], [vocab.STUDY_MODES, "studyMode"], [vocab.SCHOLARSHIP_MODES, "scholarshipMode"], [vocab.GROUPS, "group"], [vocab.EXPERIENCE, "experience"]
    ] as const;
    for (const dict of [pt, en]) {
      for (const [codes, table] of tables) {
        for (const code of codes) expect((dict.vocab[table] as Record<string, string>)[code], `${table}.${code}`).toBeTruthy();
      }
      for (const group of Object.keys(vocab.COUNTRY_GROUPS)) expect(dict.vocab.countryGroup[group], group).toBeTruthy();
    }
  });

  it("nomes de países no idioma da interface", () => {
    expect(vocab.countryName("MZ", "pt-BR")).toBe("Moçambique");
    expect(vocab.countryName("MZ", "en")).toBe("Mozambique");
    expect(vocab.sortedCountries("pt-BR")[0]!.name.localeCompare("B", "pt-BR")).toBeLessThan(0);
  });

  it("todo motivo que o motor do backend pode mandar tem frase própria em PT e EN", () => {
    const codes = [...new Set([...backend("engine.ts").matchAll(/add\("(?:met|gap|missing|failed|info)", "([a-z_]+)"/g)].map((m) => m[1]!))];
    expect(codes.length).toBeGreaterThan(30);
    for (const dict of [pt, en]) {
      for (const code of codes) {
        const text = reasonText({ kind: "met", code, params: { days: 3, levels: ["master"], level: "bachelor", groups: ["women"], max: 30, min: 2, yours: 1, mode: "online", countries: ["PT"], covered: ["tuition"], uncovered: ["living"], fields: ["law"], code: "en", type: "ielts", options: ["ielts:7"] } }, dict);
        expect(text, `${dict.meta.htmlLang} ${code}`).not.toBe(dict.reasons.unknown);
        expect(text).not.toMatch(/undefined|NaN|\[object/);
      }
    }
  });

  it("código desconhecido não quebra a página", () => {
    expect(reasonText({ kind: "info", code: "novo_criterio" }, pt)).toBe(pt.reasons.unknown);
  });
});
