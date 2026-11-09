import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/features/auth/ResetPasswordForm";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  // Página com token na URL: nunca indexar nem enviar o endereço completo para outros sites.
  return { title: t.meta.titles.reset, robots: { index: false, follow: false }, referrer: "no-referrer" };
}

export default async function ResetPasswordPage() {
  const t = await getT();
  return (
    <>
      <p className="t-label">{t.auth.resetLabel}</p>
      <h1 className="t-title">{t.auth.resetTitle}</h1>
      <p className="t-secondary">{t.auth.resetText}</p>
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </>
  );
}
