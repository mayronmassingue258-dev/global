import Link from "next/link";
import styles from "./SiteFooter.module.css";

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div>
          <p className={styles.brand}>GlobalScholar</p>
          <p className="t-meta">Gratuito para estudantes.</p>
        </div>
        <nav aria-label="Rodapé" className={styles.nav}>
          <Link href="/scholarships">Bolsas</Link>
          <Link href="/login">Entrar</Link>
          <Link href="/register">Criar conta</Link>
        </nav>
      </div>
      {/* Links legais, de privacidade e de contato entram quando houver conteúdo real. */}
    </footer>
  );
}
