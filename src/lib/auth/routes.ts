/** Áreas que exigem login. Usado pelo middleware (redireciona antes de abrir) e pelo cliente (sessão que venceu no meio do uso). */
export const PROTECTED_PREFIXES = ["/dashboard", "/applications", "/profile", "/assistant", "/eligibility", "/account"] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Destino depois do login, vindo de ?next=. Só caminhos internos ("/algo"), nunca "//site" ou "https://…":
 * impede que um link malicioso use o nosso login para mandar o estudante para outro site.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

export const SESSION_COOKIE = "gs_session";

export function loginUrl(pathWithSearch: string): string {
  return `/login?next=${encodeURIComponent(pathWithSearch)}`;
}
