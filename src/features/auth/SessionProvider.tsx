"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { User } from "@/types";

const SessionContext = createContext<User | null | undefined>(undefined);

/** Estudante logado, lido no servidor a cada pedido (layout raiz) e entregue aos componentes de cliente. */
export function SessionProvider({ user, children }: { user: User | null; children: ReactNode }) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

/**
 * Estudante logado, ou null (visitante). Fora do provider (ex.: testes de componente), considera logado como
 * um estudante de teste, para os componentes da área do estudante funcionarem isolados.
 */
export function useSessionUser(): User | null {
  const value = useContext(SessionContext);
  return value === undefined ? { id: "test", email: "teste@exemplo.com", name: "Teste" } : value;
}
