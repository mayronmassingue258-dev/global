import { ButtonLink } from "@/components/ui/ButtonLink";
import { getT } from "@/i18n/server";
import styles from "./status-page.module.css";

export default async function NotFound() {
  const t = await getT();
  return (
    <main id="main" className={`container ${styles.page}`}>
      <p className="t-label">{t.notFound.label}</p>
      <h1 className="t-title">{t.notFound.title}</h1>
      <p className="t-secondary">{t.notFound.text}</p>
      <div><ButtonLink href="/">{t.notFound.back}</ButtonLink></div>
    </main>
  );
}
