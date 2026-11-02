"use client";

import { useEffect } from "react";

/** Pede confirmação do navegador ao fechar/recarregar a aba enquanto houver alterações não salvas. */
export function useUnsavedChangesWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Navegadores antigos exigem returnValue; o texto exibido é sempre o padrão do navegador.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}
