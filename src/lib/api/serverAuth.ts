import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { SESSION_COOKIE } from "@/lib/auth/routes";
import { authService } from "@/lib/services";
import type { User } from "@/types";

/**
 * Só no servidor do Next: repassa o cookie de sessão do visitante nas chamadas ao backend feitas durante a renderização.
 * (No navegador o cookie vai sozinho, porque a API está no mesmo domínio via /api.)
 */
export async function sessionHeaders(): Promise<Record<string, string> | undefined> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? { cookie: `${SESSION_COOKIE}=${token}` } : undefined;
}

/** Estudante logado no pedido atual, ou null. Uma chamada ao backend por pedido (cache), e nenhuma sem cookie. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const headers = await sessionHeaders();
  if (!headers && process.env.NEXT_PUBLIC_DATA_MODE !== "mock") return null;
  try {
    return await authService.me(headers);
  } catch {
    // Backend fora do ar: a página continua abrindo como visitante, sem quebrar.
    return null;
  }
});
