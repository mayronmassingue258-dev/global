import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";
import { ButtonLink } from "@/components/ui/ButtonLink";
import styles from "./Hero.module.css";

const facts = ["Para estudantes\nde qualquer país", "Gratuito\npara estudantes", "Todos os níveis\nde estudo", "Descoberta, perfil\ne candidaturas"];

export function Hero() {
  return (
    <section className={`container ${styles.wrap}`} aria-labelledby="hero-title">
      <div className={styles.card}>
        <header className={styles.header}>
          <Link href="/" className={styles.brand}>GlobalScholar</Link>
          <nav className={styles.nav} aria-label="Principal">
            <Link href="/scholarships">Explorar</Link>
            <a href="#como-funciona">Como funciona</a>
          </nav>
          <Link href="/login" className={styles.signIn}>Entrar</Link>
          <ButtonLink href="/register" variant="inverse" size="sm">Começar</ButtonLink>
        </header>

        <h1 id="hero-title" className={`t-display ${styles.title}`}>Plataforma Global de Bolsas</h1>
        <p className={styles.tagline}>Descubra. Prepare. Candidate-se. Conquiste.</p>

        <form action="/scholarships" method="get" role="search" className={styles.search}>
          <label htmlFor="hero-q" className="visually-hidden">Buscar bolsas</label>
          <input id="hero-q" name="q" type="search" placeholder="Busque bolsas ou universidades…" />
          <button type="submit" className={styles.submit} aria-label="Buscar"><Search size={18} aria-hidden="true" /></button>
        </form>

        <ul className={styles.facts}>
          {facts.map((fact) => <li key={fact}>{fact}</li>)}
        </ul>

        <div className={styles.photoWrap}>
          <Image className={styles.photo} src="/images/hero-student-skyline.jpg" alt="" fill priority sizes="(min-width: 1152px) 700px, 100vw" />
        </div>
      </div>
    </section>
  );
}
