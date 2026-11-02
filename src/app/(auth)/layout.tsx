import Link from "next/link";
import styles from "./auth.module.css";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className={styles.wrap}>
      <Link href="/" className={styles.brand}>GlobalScholar</Link>
      <div className={styles.intro}>{children}</div>
    </main>
  );
}
