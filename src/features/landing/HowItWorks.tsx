import { Photo } from "@/components/media/Photo";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { getT } from "@/i18n/server";
import styles from "./HowItWorks.module.css";

export async function HowItWorks() {
  const t = await getT();
  return (
    <section id="como-funciona" className={`container ${styles.section}`} aria-labelledby="how-title">
      <figure className={styles.figure}>
        <Photo
          name="building"
          alt={t.photos.building}
          className={styles.photo}
          sizes="(min-width: 960px) 520px, 100vw"
          fallback={<span className={styles.fallbackMark}>01—04</span>}
        />
      </figure>

      <div className={styles.copy}>
        <p className="t-label">{t.landing.howLabel}</p>
        <h2 id="how-title" className="t-title">{t.landing.howTitle}</h2>
        <ol className={styles.steps}>
          {t.landing.steps.map((step, index) => (
            <li key={step.title} className={styles.step}>
              <span className={styles.number} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className="t-secondary">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <div><ButtonLink href="/scholarships">{t.landing.explore}</ButtonLink></div>
      </div>
    </section>
  );
}
