import type { Metadata } from "next";
import { ApplicationDetail } from "@/features/applications/ApplicationDetail";

export const metadata: Metadata = { title: "Candidatura", robots: { index: false } };

/**
 * Os dados vêm do ApplicationsProvider (no navegador): no modo demonstração eles só existem na memória da aba,
 * então a página não pode buscá-los no servidor. "Não encontrada" é tratado no cliente.
 */
export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ApplicationDetail id={id} />;
}
