import { AppHeader } from "@/components/layout/AppHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ApplicationsProvider } from "@/features/applications/ApplicationsProvider";
import { IS_MOCK_MODE } from "@/lib/config";
import styles from "./layout.module.css";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <ApplicationsProvider>
      <AppHeader />
      {IS_MOCK_MODE && <p className={styles.demo}>Modo demonstração · dados fictícios, sem servidor</p>}
      <main id="main" className={`container ${styles.main}`}>{children}</main>
      <SiteFooter />
    </ApplicationsProvider>
  );
}
