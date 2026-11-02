"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Notice } from "@/components/feedback/States";
import styles from "./AuthForm.module.css";

export type AuthMode = "login" | "register" | "forgot";

const submitLabel: Record<AuthMode, string> = { login: "Entrar", register: "Criar conta gratuita", forgot: "Enviar instruções" };

/** DEMONSTRAÇÃO: nenhuma autenticação real. Não cria sessão nem finge que o usuário entrou. */
export function AuthForm({ mode }: { mode: AuthMode }) {
  const [message, setMessage] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Demonstração: a autenticação ainda não está conectada. Ela será ligada quando o contrato com o backend for definido.");
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      {mode === "register" && <TextField label="Nome completo" name="name" autoComplete="name" required />}
      <TextField label="E-mail" name="email" type="email" autoComplete="email" required />
      {mode !== "forgot" && (
        <TextField
          label="Senha"
          name="password"
          type="password"
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          minLength={8}
          helper={mode === "register" ? "Mínimo de 8 caracteres." : undefined}
          required
        />
      )}
      <Button type="submit">{submitLabel[mode]}</Button>
      {message && <Notice role="status">{message}</Notice>}
      <div className={styles.links}>
        {mode === "login" && <><Link href="/forgot-password">Esqueci minha senha</Link><Link href="/register">Ainda não tem conta? Criar conta</Link></>}
        {mode === "register" && <Link href="/login">Já tem conta? Entrar</Link>}
        {mode === "forgot" && <Link href="/login">Voltar para entrar</Link>}
      </div>
    </form>
  );
}
