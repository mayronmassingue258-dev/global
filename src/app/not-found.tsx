import { ButtonLink } from "@/components/ui/ButtonLink";
import styles from "./status-page.module.css";

export default function NotFound() {
  return (
    <main id="main" className={`container ${styles.page}`}>
      <p className="t-label">404 · Página não encontrada</p>
      <h1 className="t-title">Esta página não existe.</h1>
      <p className="t-secondary">O endereço pode ter mudado ou estar incorreto.</p>
      <div><ButtonLink href="/">Voltar ao início</ButtonLink></div>
    </main>
  );
}
