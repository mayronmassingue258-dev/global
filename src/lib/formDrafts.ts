/**
 * Cópia de segurança de edições NÃO SALVAS de formulários, no sessionStorage da aba:
 * some ao salvar com sucesso, ao descartar ou ao fechar a aba. Nunca guarde senhas aqui.
 * Toda leitura/escrita é protegida: em navegação privada ou com armazenamento bloqueado, simplesmente não guarda.
 */
const PREFIX = "gs:unsaved:";

export function readFormDraft<T>(key: string, isValid: (value: unknown) => value is T): T | null {
  try {
    const raw = window.sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    return isValid(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeFormDraft(key: string, value: unknown): void {
  try {
    window.sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Sem armazenamento disponível: segue sem cópia de segurança.
  }
}

export function clearFormDraft(key: string): void {
  try {
    window.sessionStorage.removeItem(PREFIX + key);
  } catch {
    // idem
  }
}
