import type { Metadata } from "next";
import { PageHeading } from "@/components/layout/PageHeading";
import { ScholarshipBrowser } from "@/features/scholarships/ScholarshipBrowser";

export const metadata: Metadata = { title: "Bolsas" };

export default async function ScholarshipsPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  const initialQuery = Array.isArray(q) ? (q[0] ?? "") : (q ?? "");

  return (
    <>
      <PageHeading eyebrow="Explorar" title="Encontre sua oportunidade." description="Pesquise por nome, instituição, país e nível de estudo. Confirme sempre os detalhes no site oficial do provedor." />
      <ScholarshipBrowser initialQuery={initialQuery} />
    </>
  );
}
