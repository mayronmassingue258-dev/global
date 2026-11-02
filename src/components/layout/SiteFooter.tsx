import Link from "next/link";
import { getT } from "@/i18n/server";
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";
import styles from "./SiteFooter.module.css";

export async function SiteFooter() {
  const t = await getT();
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div>
          <p className={styles.brand}>{t.common.brand}</p>
          <p className="t-meta">{t.nav.footerTagline}</p>
        </div>
        <nav aria-label={t.nav.footer} className={styles.nav}>
          <Link href="/scholarships">{t.nav.scholarships}</Link>
          <Link href="/login">{t.nav.signIn}</Link>
          <Link href="/register">{t.nav.createAccount}</Link>
          <LanguageSwitcher />
        </nav>
      </div>
      {/* Links legais, de privacidade e de contato entram quando houver conteúdo real. */}
    </footer>
  );
}
