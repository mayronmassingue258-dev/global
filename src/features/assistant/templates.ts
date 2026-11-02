import type { Dictionary } from "@/i18n/config";
import type { DocumentType } from "@/types";

export type SectionTemplate = { key: string; title: string; hint: string; targetWords: [number, number] };
export type DocumentTemplate = { type: DocumentType; label: string; description: string; sections: SectionTemplate[] };

/**
 * Estrutura de cada tipo de documento: chaves das seções (gravadas na API) e faixas de palavras de referência.
 * Títulos e orientações vêm do dicionário (`t.templates`). O edital da bolsa sempre prevalece.
 */
const STRUCTURE: Record<DocumentType, [key: string, min: number, max: number][]> = {
  motivation_letter: [["opening", 40, 90], ["motivation", 80, 160], ["evidence", 120, 220], ["fit", 80, 160], ["goals", 60, 140], ["closing", 30, 70]],
  academic_cv: [["education", 30, 120], ["research", 40, 200], ["experience", 40, 200], ["awards", 0, 100], ["languages", 5, 50], ["skills", 10, 80]],
  personal_statement: [["origin", 80, 160], ["challenge", 100, 200], ["learning", 80, 160], ["future", 60, 140]],
  document_review: [["original", 0, 1000], ["checklist", 0, 300]]
};

export const DOCUMENT_TYPE_ORDER: DocumentType[] = ["motivation_letter", "academic_cv", "personal_statement", "document_review"];

export function getTemplate(t: Dictionary, type: DocumentType): DocumentTemplate {
  const text = t.templates[type];
  const sections = text.sections as Record<string, { title: string; hint: string }>;
  return {
    type,
    label: text.label,
    description: text.description,
    sections: STRUCTURE[type].map(([key, min, max]) => ({ key, title: sections[key]!.title, hint: sections[key]!.hint, targetWords: [min, max] }))
  };
}

export function sectionKeys(type: DocumentType): string[] {
  return STRUCTURE[type].map(([key]) => key);
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** Documento inteiro em texto simples, com títulos de seção, para copiar. Seções vazias ficam de fora. */
export function toPlainText(template: DocumentTemplate, title: string, sections: Record<string, string>): string {
  const parts = template.sections
    .filter((s) => sections[s.key]?.trim())
    .map((s) => `${s.title.toUpperCase()}\n\n${sections[s.key]!.trim()}`);
  return [title.trim(), ...parts].join("\n\n\n");
}
