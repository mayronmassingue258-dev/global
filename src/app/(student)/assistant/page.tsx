import type { Metadata } from "next";
import { Suspense } from "react";
import { Photo } from "@/components/media/Photo";
import { ListSkeleton } from "@/components/feedback/Skeleton";
import { AssistantWorkspace } from "@/features/assistant/AssistantWorkspace";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Assistente de documentos" };

export default function AssistantPage() {
  return (
    <>
      <div className={styles.intro}>
        <div className={styles.copy}>
          <p className="t-label">Documentos</p>
          <h1 className="t-title">Deixe sua história clara.</h1>
          <p className="t-secondary">
            Cartas, currículos e declarações com uma estrutura que orienta cada parte. Seus rascunhos ficam salvos e você retoma de onde parou.
          </p>
        </div>
        <Photo name="library" alt="" className={styles.photo} sizes="(min-width: 960px) 420px, 100vw" priority fallback={<span className={styles.mark}>Aa</span>} />
      </div>
      {/* useSearchParams (rascunho aberto na URL) exige um limite de Suspense. */}
      <Suspense fallback={<ListSkeleton rows={3} label="Carregando assistente…" />}>
        <AssistantWorkspace />
      </Suspense>
    </>
  );
}
