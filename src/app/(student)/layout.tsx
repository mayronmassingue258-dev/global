import { AppHeader } from "@/components/layout/AppHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ApplicationsProvider } from "@/features/applications/ApplicationsProvider";
import { MutationErrorNotice } from "@/features/applications/MutationErrorNotice";
import { IS_MOCK_MODE } from "@/lib/config";
import { getT } from "@/i18n/server";
import styles from "./layout.module.css";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const t = await getT();
  return (
    <ApplicationsProvider>
      <AppHeader />
      {IS_MOCK_MODE && <p className={styles.demo}>{t.common.demoBanner}</p>}
      <MutationErrorNotice />
      <main id="main" className={`container ${styles.main}`}>{children}</main>
      <SiteFooter />
    </ApplicationsProvider>
  );
}
