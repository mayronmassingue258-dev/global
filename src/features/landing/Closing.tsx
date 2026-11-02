import { Photo } from "@/components/media/Photo";
import { ButtonLink } from "@/components/ui/ButtonLink";
import styles from "./Closing.module.css";

export function Closing() {
  return (
    <section className={`container ${styles.wrap}`} aria-labelledby="closing-title">
      <div className={styles.band}>
        <Photo name="campus" alt="" className={styles.photo} sizes="(min-width: 1152px) 1088px, 100vw" />
        <div className={styles.copy}>
          <h2 id="closing-title" className="t-title">Seu próximo capítulo começa com um plano.</h2>
          <p>Gratuito para estudantes. Comece pelo perfil e veja o que cada bolsa pede de você.</p>
          <div className={styles.actions}>
            <ButtonLink href="/register" variant="inverse">Criar conta gratuita</ButtonLink>
            <ButtonLink href="/scholarships" variant="tertiary" className={styles.link}>Explorar bolsas</ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
