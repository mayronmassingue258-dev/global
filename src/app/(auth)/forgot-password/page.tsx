import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/AuthForm";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.meta.titles.forgot, robots: { index: false } };
}

export default async function Page() {
  const t = await getT();
  return (
    <>
      <p className="t-label">{t.auth.forgotLabel}</p>
      <h1 className="t-title">{t.auth.forgotTitle}</h1>
      <p className="t-secondary">{t.auth.forgotText}</p>
      <AuthForm mode="forgot" />
    </>
  );
}
