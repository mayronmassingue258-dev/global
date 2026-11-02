import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/AuthForm";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function ForgotPasswordPage() {
  return (
    <>
      <p className="t-label">Recuperação de acesso</p>
      <h1 className="t-title">Esqueceu sua senha?</h1>
      <p className="t-secondary">Informe seu e-mail e enviaremos as instruções quando o serviço estiver conectado.</p>
      <AuthForm mode="forgot" />
    </>
  );
}
