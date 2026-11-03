"use client";

import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_COOKIE, type Locale } from "./config";
import { useLocale, useT } from "./I18nProvider";
import styles from "./LanguageSwitcher.module.css";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Troca o idioma: grava a preferência e pede ao servidor a página de novo (sem perder a rota atual). */
export function LanguageSwitcher({ tone = "light" }: { tone?: "light" | "dark" }) {
  const locale = useLocale();
  const t = useT();
  const router = useRouter();

  const choose = (next: Locale) => {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
    document.documentElement.lang = next === "pt" ? "pt-BR" : "en";
    router.refresh();
  };

  return (
    <div className={`${styles.group} ${tone === "dark" ? styles.dark : ""}`} role="group" aria-label={t.common.language}>
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          lang={code === "pt" ? "pt-BR" : "en"}
          className={styles.option}
          aria-pressed={code === locale}
          // O nome acessível começa pelo texto visível ("PT"), para quem usa comando de voz (WCAG 2.5.3).
          aria-label={`${code.toUpperCase()} · ${t.common.languageNames[code]}`}
          onClick={() => choose(code)}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
