import { ListChecks, Search, Sparkles, UserRound } from "lucide-react";
import { ButtonLink } from "@/components/ui/ButtonLink";
import styles from "./Features.module.css";

const items = [
  { icon: Search, title: "Encontre bolsas", text: "Explore oportunidades acadêmicas" },
  { icon: UserRound, title: "Monte seu perfil", text: "Organize sua trajetória acadêmica" },
  { icon: Sparkles, title: "Assistente de documentos", text: "Rascunhos de currículo e cartas (em desenvolvimento)" },
  { icon: ListChecks, title: "Acompanhe candidaturas", text: "Organize etapas e prazos" }
];

export function Features() {
  return (
    <section id="como-funciona" className={`container ${styles.section}`} aria-labelledby="features-title">
      <div className={styles.copy}>
        <h2 id="features-title" className="t-title">Tudo o que você precisa, em um só lugar.</h2>
        <p className="t-secondary">Da descoberta de bolsas à preparação da candidatura, ajudamos você a transformar seus objetivos em um plano.</p>
        <ButtonLink href="/scholarships">Explorar bolsas</ButtonLink>
      </div>
      <ul className={styles.grid}>
        {items.map(({ icon: Icon, title, text }) => (
          <li key={title} className={styles.item}>
            <Icon size={18} aria-hidden="true" />
            <h3>{title}</h3>
            <p>{text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
