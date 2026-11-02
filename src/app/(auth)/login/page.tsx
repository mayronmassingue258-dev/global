import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/AuthForm";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <>
      <p className="t-label">Bem-vindo de volta</p>
      <h1 className="t-title">Continue sua jornada.</h1>
      <p className="t-secondary">Entre para voltar ao seu espaço de trabalho.</p>
      <AuthForm mode="login" />
    </>
  );
}
