"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./AppHeader.module.css";

const links = [
  { href: "/dashboard", label: "Painel", match: ["/dashboard"] },
  { href: "/scholarships", label: "Bolsas", match: ["/scholarships", "/eligibility"] },
  { href: "/applications", label: "Candidaturas", match: ["/applications"] },
  { href: "/profile", label: "Perfil", match: ["/profile"] },
  { href: "/assistant", label: "Assistente", match: ["/assistant"] }
];

/** Navegação da área do estudante. Em telas pequenas vira uma faixa rolável, sempre visível. */
export function AppHeader() {
  const pathname = usePathname() ?? "";
  return (
    <header className={styles.header}>
      <div className={`container ${styles.bar}`}>
        <Link href="/dashboard" className={styles.brand}>GlobalScholar</Link>
        <Link href="/" className={styles.home}>Página inicial</Link>
      </div>
      <nav className={`container ${styles.nav}`} aria-label="Área do estudante">
        {links.map((link) => {
          const active = link.match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
          return <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined}>{link.label}</Link>;
        })}
      </nav>
    </header>
  );
}
