import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * false no HTML vindo do servidor e durante a hidratação; true quando o JavaScript da página já está ativo.
 * Formulários com senha usam isto para não aceitar envio antes da hora: sem o JavaScript, o navegador enviaria o
 * formulário sozinho e a página só recarregaria (em rede lenta ou com o servidor "acordando", parecia que o login não
 * funcionava).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
