import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/AuthForm";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.meta.titles.register, robots: { index: false } };
}

export default async function Page() {
  const t = await getT();
  return (
    <>
      <p className="t-label">{t.auth.registerLabel}</p>
      <h1 className="t-title">{t.auth.registerTitle}</h1>
      <p className="t-secondary">{t.auth.registerText}</p>
      <AuthForm mode="register" />
    </>
  );
}
