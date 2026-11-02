import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/AuthForm";

export const metadata: Metadata = { title: "Criar conta" };

export default function RegisterPage() {
  return (
    <>
      <p className="t-label">Conta gratuita para estudantes</p>
      <h1 className="t-title">Comece pelo seu perfil.</h1>
      <p className="t-secondary">Crie seu espaço de trabalho e organize suas oportunidades acadêmicas.</p>
      <AuthForm mode="register" />
    </>
  );
}
