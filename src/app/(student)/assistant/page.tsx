import type { Metadata } from "next";
import { PageHeading } from "@/components/layout/PageHeading";
import { AssistantWorkspace } from "@/features/assistant/AssistantWorkspace";

export const metadata: Metadata = { title: "Assistente de documentos" };

export default function AssistantPage() {
  return (
    <>
      <PageHeading eyebrow="Documentos" title="Deixe sua história clara." description="Prepare roteiros para documentos acadêmicos. O serviço de IA será conectado pelo backend depois que o contrato for definido." />
      <AssistantWorkspace />
    </>
  );
}
