import { Photo } from "@/components/media/Photo";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { getT } from "@/i18n/server";
import styles from "./Closing.module.css";

export async function Closing() {
  const t = await getT();
  return (
    <section className={`container ${styles.wrap}`} aria-labelledby="closing-title">
      <div className={styles.band}>
        <Photo name="campus" alt="" className={styles.photo} sizes="(min-width: 768px) 420px, 100vw" />
        <div className={styles.copy}>
          <h2 id="closing-title" className="t-title">{t.landing.closingTitle}</h2>
          <p>{t.landing.closingText}</p>
          <div className={styles.actions}>
            <ButtonLink href="/register" variant="inverse">{t.landing.closingCta}</ButtonLink>
            <ButtonLink href="/scholarships" variant="tertiary" className={styles.link}>{t.landing.explore}</ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
