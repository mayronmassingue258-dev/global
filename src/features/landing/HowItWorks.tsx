import { Photo } from "@/components/media/Photo";
import { ButtonLink } from "@/components/ui/ButtonLink";
import styles from "./HowItWorks.module.css";

const steps = [
  { title: "Encontre bolsas", text: "Pesquise por país, nível e área. Cada oportunidade mostra prazo, cobertura, requisitos e a fonte oficial." },
  { title: "Monte seu perfil", text: "Registre formação, notas e idiomas uma vez. Ele passa a orientar a avaliação de elegibilidade." },
  { title: "Entenda o que falta", text: "Para cada bolsa, veja o que você já atende e o que ainda precisa informar, sem promessas de aprovação." },
  { title: "Organize a candidatura", text: "Acompanhe prazos, documentos e notas, e escreva cartas e currículos com uma estrutura clara." }
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className={`container ${styles.section}`} aria-labelledby="how-title">
      <figure className={styles.figure}>
        <Photo
          name="building"
          className={styles.photo}
          sizes="(min-width: 960px) 520px, 100vw"
          fallback={<span className={styles.fallbackMark}>01—04</span>}
        />
      </figure>

      <div className={styles.copy}>
        <p className="t-label">Como funciona</p>
        <h2 id="how-title" className="t-title">Do interesse à candidatura, em quatro passos.</h2>
        <ol className={styles.steps}>
          {steps.map((step, index) => (
            <li key={step.title} className={styles.step}>
              <span className={styles.number} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className="t-secondary">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <div><ButtonLink href="/scholarships">Explorar bolsas</ButtonLink></div>
      </div>
    </section>
  );
}
