"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { DEFAULT_LOCALE, getDictionary, type Dictionary, type Locale } from "./config";

const I18nContext = createContext<Locale | null>(null);

/** Recebe só o código do idioma (os dicionários têm funções, que não podem atravessar do servidor para o cliente). */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <I18nContext.Provider value={locale}>{children}</I18nContext.Provider>;
}

/** Sem provider (ex.: testes de componente), usa o português. */
export function useLocale(): Locale {
  return useContext(I18nContext) ?? DEFAULT_LOCALE;
}

export function useT(): Dictionary {
  return getDictionary(useLocale());
}
