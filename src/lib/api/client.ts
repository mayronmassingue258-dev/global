import { API_BASE_URL, SERVER_API_BASE_URL } from "@/lib/config";
import { isProtectedPath, loginUrl } from "@/lib/auth/routes";

/**
 * Erro de API com mensagem segura para exibir. O corpo bruto da resposta nunca é mostrado ao usuário.
 * `code` e `fields` vêm do envelope de erro do contrato (docs/api-contract.md) quando presentes;
 * a interface usa apenas os CÓDIGOS para escolher as próprias mensagens.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly fields?: Record<string, string>;
  constructor(status: number, message: string, code?: string, fields?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

/** `body` é enviado como JSON; `rawBody` (ex.: FormData) vai como está, e o navegador define o Content-Type. */
type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown; rawBody?: BodyInit };

export function safeMessage(status: number): string {
  if (status === 0) return "Não foi possível conectar ao servidor.";
  if (status === 401) return "Entre na sua conta para continuar.";
  if (status === 403) return "Você não tem permissão para acessar este recurso.";
  if (status === 404) return "Recurso não encontrado.";
  if (status === 409) return "Este registro já existe.";
  if (status === 422) return "Alguns campos são inválidos. Revise e tente novamente.";
  if (status === 429) return "Muitas solicitações. Aguarde um instante e tente novamente.";
  if (status >= 500) return "O servidor encontrou um problema. Tente novamente em instantes.";
  return "Não foi possível concluir a solicitação.";
}

/** Lê `{ error: { code, fields } }` sem confiar no formato; ignora qualquer outra coisa. */
async function readErrorEnvelope(response: Response): Promise<{ code?: string; fields?: Record<string, string> }> {
  try {
    const data: unknown = await response.json();
    if (typeof data !== "object" || data === null) return {};
    const error = (data as { error?: unknown }).error;
    if (typeof error !== "object" || error === null) return {};
    const { code, fields } = error as { code?: unknown; fields?: unknown };
    const out: { code?: string; fields?: Record<string, string> } = {};
    if (typeof code === "string") out.code = code;
    if (typeof fields === "object" && fields !== null) {
      out.fields = Object.fromEntries(Object.entries(fields).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
    }
    return out;
  } catch {
    return {};
  }
}

const isBrowser = () => typeof window !== "undefined";

/**
 * Sessão venceu enquanto o estudante usava uma área privada: leva ao login e volta para onde estava depois.
 * Em páginas públicas (busca, detalhe da bolsa) um 401 não redireciona: só mostra a versão para visitantes.
 */
function redirectToLoginIfPrivate() {
  const { pathname, search } = window.location;
  if (isProtectedPath(pathname)) window.location.assign(loginUrl(`${pathname}${search}`));
}

/**
 * Cliente HTTP central. Autenticação por cookie de sessão HttpOnly (docs/api-contract.md, "Contas"):
 * no navegador a base é "/api" (mesmo domínio do site), então o cookie vai sozinho (`credentials: "same-origin"`).
 * No servidor do Next, quem chama passa o cookie do pedido em `headers.cookie` (ver lib/api/serverAuth.ts).
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const base = isBrowser() ? API_BASE_URL : SERVER_API_BASE_URL;
  if (!base) throw new ApiError(0, "A URL da API não está configurada.", "config_missing");

  const { body, rawBody, ...init } = options;
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (body !== undefined && rawBody === undefined) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      cache: "no-store",
      credentials: "same-origin",
      ...init,
      headers,
      body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body))
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, safeMessage(0), "network_error");
  }

  if (!response.ok) {
    if (response.status === 401 && isBrowser() && !path.startsWith("/auth/")) redirectToLoginIfPrivate();
    const { code, fields } = await readErrorEnvelope(response);
    throw new ApiError(response.status, safeMessage(response.status), code, fields);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
