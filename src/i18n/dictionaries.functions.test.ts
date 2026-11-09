import { describe, expect, it } from "vitest";
import pt from "./dictionaries/pt";
import en from "./dictionaries/en";

/** Chama cada função de texto (plurais, nomes, datas) nos dois idiomas: nenhuma pode quebrar ou devolver vazio. */
function functionsOf(obj: unknown, path = ""): [string, (...args: unknown[]) => unknown][] {
  if (typeof obj === "function") return [[path, obj as (...args: unknown[]) => unknown]];
  if (typeof obj !== "object" || obj === null) return [];
  return Object.entries(obj).flatMap(([k, v]) => functionsOf(v, path ? `${path}.${k}` : k));
}

describe("funções dos dicionários", () => {
  for (const [lang, dict] of [["pt", pt], ["en", en]] as const) {
    it(`${lang}: todas devolvem texto com argumentos de exemplo`, () => {
      const fns = functionsOf(dict);
      expect(fns.length).toBeGreaterThan(30);
      for (const [path, fn] of fns) {
        for (const args of [[1, 2], [3, 10], ["Exemplo", "Outro"], [true]]) {
          const out = fn(...args);
          expect(typeof out, path).toBe("string");
          expect((out as string).length, path).toBeGreaterThan(0);
        }
      }
    });
  }
});
