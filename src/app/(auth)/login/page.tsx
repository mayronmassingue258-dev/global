import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/AuthForm";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.meta.titles.login, robots: { index: false } };
}

export default async function Page() {
  const t = await getT();
  return (
    <>
      <p className="t-label">{t.auth.loginLabel}</p>
      <h1 className="t-title">{t.auth.loginTitle}</h1>
      <p className="t-secondary">{t.auth.loginText}</p>
      <AuthForm mode="login" />
    </>
  );
}
