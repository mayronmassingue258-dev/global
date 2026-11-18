import type { Metadata } from "next";
import { PageHeading } from "@/components/layout/PageHeading";
import { Notice } from "@/components/feedback/States";
import { AdminPanel } from "@/features/admin/AdminPanel";
import { getT } from "@/i18n/server";
import { getCurrentUser } from "@/lib/api/serverAuth";
import { IS_MOCK_MODE } from "@/lib/config";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).meta.titles.admin, robots: { index: false } };
}

export const dynamic = "force-dynamic";

/** Painel das bolsas. A página só aparece para administradores; o servidor confere de novo em cada chamada. */
export default async function AdminPage() {
  const [t, user] = await Promise.all([getT(), IS_MOCK_MODE ? Promise.resolve(null) : getCurrentUser()]);
  return (
    <>
      <PageHeading eyebrow={t.admin.eyebrow} title={t.admin.title} description={t.admin.text} />
      {IS_MOCK_MODE ? <Notice>{t.admin.demo}</Notice> : user?.role === "admin" ? <AdminPanel /> : <Notice role="alert">{t.admin.forbidden}</Notice>}
    </>
  );
}
