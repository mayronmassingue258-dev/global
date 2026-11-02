import type { Metadata } from "next";
import { PageHeading } from "@/components/layout/PageHeading";
import { ApplicationsBoard } from "@/features/applications/ApplicationsBoard";

export const metadata: Metadata = { title: "Candidaturas" };

export default function ApplicationsPage() {
  return (
    <>
      <PageHeading eyebrow="Acompanhamento" title="Mantenha cada etapa visível." description="Organize as bolsas que você salvou, atualize o andamento e acompanhe os prazos." />
      <ApplicationsBoard />
    </>
  );
}
