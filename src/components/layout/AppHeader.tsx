"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";
import { useT } from "@/i18n/I18nProvider";
import styles from "./AppHeader.module.css";

/** Navegação da área do estudante. Em telas pequenas vira uma faixa rolável, sempre visível. */
export function AppHeader() {
  const pathname = usePathname() ?? "";
  const t = useT();
  const links = [
    { href: "/dashboard", label: t.nav.dashboard, match: ["/dashboard"] },
    { href: "/scholarships", label: t.nav.scholarships, match: ["/scholarships", "/eligibility"] },
    { href: "/applications", label: t.nav.applications, match: ["/applications"] },
    { href: "/profile", label: t.nav.profile, match: ["/profile"] },
    { href: "/assistant", label: t.nav.assistant, match: ["/assistant"] }
  ];
  return (
    <header className={styles.header}>
      <div className={`container ${styles.bar}`}>
        <Link href="/dashboard" className={styles.brand}>{t.common.brand}</Link>
        <div className={styles.tools}>
          <LanguageSwitcher />
          <Link href="/" className={styles.home}>{t.nav.home}</Link>
        </div>
      </div>
      <nav className={`container ${styles.nav}`} aria-label={t.nav.student}>
        {links.map((link) => {
          const active = link.match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
          return <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined}>{link.label}</Link>;
        })}
      </nav>
    </header>
  );
}
