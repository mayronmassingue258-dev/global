import type { Metadata } from "next";
import { Suspense } from "react";
import { Photo } from "@/components/media/Photo";
import { ListSkeleton } from "@/components/feedback/Skeleton";
import { AssistantWorkspace } from "@/features/assistant/AssistantWorkspace";
import { getT } from "@/i18n/server";
import styles from "./page.module.css";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).meta.titles.assistant, robots: { index: false } };
}

export default async function AssistantPage() {
  const t = await getT();
  return (
    <>
      <div className={styles.intro}>
        <div className={styles.copy}>
          <p className="t-label">{t.assistant.eyebrow}</p>
          <h1 className="t-title">{t.assistant.title}</h1>
          <p className="t-secondary">{t.assistant.text}</p>
        </div>
        <Photo name="library" alt="" className={styles.photo} sizes="(min-width: 960px) 320px, 100vw" priority fallback={<span className={styles.mark}>Aa</span>} />
      </div>
      {/* useSearchParams (rascunho aberto na URL) exige um limite de Suspense. */}
      <Suspense fallback={<ListSkeleton rows={3} label={t.assistant.loading} />}>
        <AssistantWorkspace />
      </Suspense>
    </>
  );
}
