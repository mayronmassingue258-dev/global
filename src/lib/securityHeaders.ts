/**
 * Cabeçalhos de segurança aplicados a todas as respostas (next.config.ts).
 * A CSP só é aplicada em produção: o modo de desenvolvimento do Next usa eval e WebSocket para recarregar a página.
 */
export function apiOrigin(apiBaseUrl: string | undefined): string | null {
  if (!apiBaseUrl) return null;
  try {
    return new URL(apiBaseUrl).origin;
  } catch {
    return null;
  }
}

export function contentSecurityPolicy(apiBaseUrl: string | undefined): string {
  const api = apiOrigin(apiBaseUrl);
  return [
    "default-src 'self'",
    // O App Router injeta scripts inline para entregar os dados do servidor; sem nonce, 'unsafe-inline' é necessário.
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${api ? ` ${api}` : ""}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'"
  ].join("; ");
}

export function securityHeaders(options: { production: boolean; apiBaseUrl: string | undefined }) {
  const headers = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" }
  ];
  if (options.production) {
    headers.push({ key: "Content-Security-Policy", value: contentSecurityPolicy(options.apiBaseUrl) });
    // Só tem efeito em HTTPS (o Render serve HTTPS); navegadores ignoram em HTTP.
    headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" });
  }
  return headers;
}
