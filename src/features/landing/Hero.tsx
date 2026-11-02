import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";
import { getT } from "@/i18n/server";
import styles from "./Hero.module.css";

export async function Hero() {
  const t = await getT();
  return (
    <section className={`container ${styles.wrap}`} aria-labelledby="hero-title">
      <div className={styles.card}>
        <header className={styles.header}>
          <Link href="/" className={styles.brand}>{t.common.brand}</Link>
          <nav className={styles.nav} aria-label={t.nav.main}>
            <Link href="/scholarships">{t.nav.explore}</Link>
            <a href="#como-funciona">{t.nav.howItWorks}</a>
          </nav>
          <span className={styles.lang}><LanguageSwitcher tone="dark" /></span>
          <Link href="/login" className={styles.signIn}>{t.nav.signIn}</Link>
          <ButtonLink href="/register" variant="inverse" size="sm">{t.nav.getStarted}</ButtonLink>
        </header>

        <h1 id="hero-title" className={`t-display ${styles.title}`}>{t.landing.title}</h1>
        <p className={styles.tagline}>{t.landing.tagline}</p>

        <form action="/scholarships" method="get" role="search" className={styles.search}>
          <label htmlFor="hero-q" className="visually-hidden">{t.landing.searchLabel}</label>
          <input id="hero-q" name="q" type="search" placeholder={t.landing.searchPlaceholder} />
          <button type="submit" className={styles.submit} aria-label={t.landing.searchSubmit}><Search size={18} aria-hidden="true" /></button>
        </form>

        <ul className={styles.facts}>
          {t.landing.facts.map((fact) => <li key={fact}>{fact}</li>)}
        </ul>

        <div className={styles.photoWrap}>
          <Image className={styles.photo} src="/images/hero-student-skyline.jpg" alt="" fill priority sizes="(min-width: 1152px) 700px, 100vw" />
        </div>
      </div>
    </section>
  );
}
