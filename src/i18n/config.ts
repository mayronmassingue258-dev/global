import en from "./dictionaries/en";
import pt, { type Dictionary } from "./dictionaries/pt";

export const LOCALES = ["pt", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "pt";

/**
 * O idioma escolhido fica num cookie de preferência (não identifica ninguém).
 * As URLs são as mesmas nos dois idiomas; ver README ("Idiomas") para a troca que isso implica em SEO.
 */
export const LOCALE_COOKIE = "gs_locale";

const dictionaries: Record<Locale, Dictionary> = { pt, en };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export type { Dictionary };
