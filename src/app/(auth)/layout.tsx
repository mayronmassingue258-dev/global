import Link from "next/link";
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";
import { getT } from "@/i18n/server";
import styles from "./auth.module.css";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getT();
  return (
    <main id="main" className={styles.wrap}>
      <div className={styles.top}>
        <Link href="/" className={styles.brand}>{t.common.brand}</Link>
        <LanguageSwitcher />
      </div>
      <div className={styles.intro}>{children}</div>
    </main>
  );
}
